// The orchestration engine.
//
//   1. PLAN       – the Orchestrator decomposes the goal into a dependency graph (DAG)
//                   of subtasks, each owned by a specialist agent it designs.
//   2. EXECUTE    – a scheduler runs every task whose dependencies are satisfied,
//                   in parallel, passing upstream outputs downstream as context.
//   3. REVIEW     – a Quality Reviewer scores every deliverable and can send weak
//                   ones back with concrete feedback.
//   4. REVISE     – flagged agents rewrite their work using that feedback.
//   5. SYNTHESIZE – a Synthesizer merges everything into one final deliverable.
//
// Every step emits events, which the HTTP handler streams to the browser.

import { callTool, streamText } from './anthropic.js';

export const MODELS = ['claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-opus-5-5'];
export const DEFAULT_MODEL = MODELS.includes(process.env.ANTHROPIC_MODEL)
  ? process.env.ANTHROPIC_MODEL
  : 'claude-sonnet-5-5';

const MAX_PARALLEL = 4;
const MAX_REVISIONS = 2;
const MIN_TASKS = 3;
const MAX_TASKS = 6;

const PLAN_TOOL = {
  name: 'create_plan',
  description: 'Submit the execution plan: a dependency graph of subtasks, each owned by a specialist agent.',
  input_schema: {
    type: 'object',
    properties: {
      goal: { type: 'string', description: 'The goal restated precisely in one sentence.' },
      strategy: { type: 'string', description: 'Two or three sentences on how the team will tackle it and why this split.' },
      tasks: {
        type: 'array',
        minItems: MIN_TASKS,
        maxItems: MAX_TASKS,
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Short id: t1, t2, ...' },
            title: { type: 'string', description: 'Deliverable title, 3-7 words.' },
            agent_name: { type: 'string', description: 'Specialist role name, e.g. "Market Researcher".' },
            agent_role: { type: 'string', description: 'One sentence describing the agent\'s expertise.' },
            icon: { type: 'string', description: 'A single emoji representing the agent.' },
            instructions: { type: 'string', description: 'Specific, self-contained instructions: what to produce, what to cover, what format.' },
            depends_on: { type: 'array', items: { type: 'string' }, description: 'Ids of tasks whose output this task needs. Empty if independent.' },
          },
          required: ['id', 'title', 'agent_name', 'agent_role', 'icon', 'instructions', 'depends_on'],
        },
      },
    },
    required: ['goal', 'strategy', 'tasks'],
  },
};

const REVIEW_TOOL = {
  name: 'submit_review',
  description: 'Submit a quality review of every deliverable.',
  input_schema: {
    type: 'object',
    properties: {
      overall: { type: 'string', description: 'One or two sentences on the overall quality of the team\'s work.' },
      reviews: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            task_id: { type: 'string' },
            score: { type: 'integer', minimum: 1, maximum: 10 },
            verdict: { type: 'string', enum: ['approve', 'revise'] },
            feedback: { type: 'string', description: 'Concrete, actionable feedback. For revise: exactly what is missing or wrong.' },
          },
          required: ['task_id', 'score', 'verdict', 'feedback'],
        },
      },
    },
    required: ['overall', 'reviews'],
  },
};

const PLANNER_SYSTEM = `You are the Orchestrator of a multi-agent AI system. You never do the work yourself: you design the team and the plan.

Break the user's goal into ${MIN_TASKS}-${MAX_TASKS} subtasks. For each, invent a distinct specialist agent best suited to it.
Rules:
- Maximise parallelism. Only add a dependency when a task genuinely needs another task's output. At least two tasks must have no dependencies.
- No task may depend on a task that comes after it in the list (the graph must be acyclic).
- Subtasks must not overlap; together they must fully cover the goal.
- Do NOT create a final "compile/summarise/synthesise" task — a dedicated Synthesizer agent does that afterwards.
- Instructions must be specific and self-contained (the agent sees only its instructions plus its dependencies' outputs).
Call create_plan.`;

const REVIEWER_SYSTEM = `You are the Quality Reviewer in a multi-agent AI system. You check every specialist's deliverable against its assignment and the overall goal.
Score each from 1-10. Be demanding but fair: use verdict "revise" only when a deliverable has a real gap (missing required content, vague where specifics were needed, wrong, or contradicting a teammate) — typically a score below 7. Approve solid work.
Feedback must be concrete and actionable. Call submit_review.`;

const SYNTH_SYSTEM = `You are the Synthesizer in a multi-agent AI system. Merge the specialists' deliverables into ONE polished final deliverable for the user, in Markdown.
- Start with a "# " title, then a short "TL;DR" (3-5 bullets).
- Organise into clear sections with headings; use tables where they help.
- Resolve contradictions, remove repetition, keep the specific numbers, names and recommendations.
- End with concrete next steps.
- Do not mention the agents, the review, or the process. Write as the final answer.`;

const workerSystem = (t) => `You are ${t.agent_name}. ${t.agent_role}
You are one specialist on a team of AI agents coordinated by an Orchestrator. Do ONLY your assigned part, and do it thoroughly.
- Write in Markdown with short headings, bullets and tables where useful.
- Be concrete: specific numbers, names, examples and recommendations. No filler, no introduction about yourself.
- Aim for 200-400 words.`;

function workerPrompt(plan, task, outputs, revision) {
  let p = `# Overall goal\n${plan.goal}\n\n# Your assignment: ${task.title}\n${task.instructions}\n`;
  const deps = task.depends_on.map((id) => plan.tasks.find((t) => t.id === id)).filter(Boolean);
  if (deps.length) {
    p += `\n# Inputs from your teammates\n`;
    for (const d of deps) p += `\n## From ${d.agent_name} — ${d.title}\n${outputs[d.id]}\n`;
  }
  if (revision) {
    p += `\n# Reviewer feedback on your previous draft (score ${revision.score}/10)\n${revision.feedback}\n\n# Your previous draft\n${revision.previous}\n\nWrite an improved, complete version of your deliverable that fully addresses the feedback.`;
  }
  return p;
}

/** Normalise the model's plan into a valid DAG with unique ids. */
export function sanitizePlan(raw, fallbackGoal) {
  const tasks = (Array.isArray(raw?.tasks) ? raw.tasks : []).slice(0, MAX_TASKS);
  const seen = new Set();
  const clean = tasks.map((t, i) => {
    let id = String(t.id || `t${i + 1}`).trim() || `t${i + 1}`;
    if (seen.has(id)) id = `t${i + 1}_${i}`;
    seen.add(id);
    return {
      id,
      title: String(t.title || `Subtask ${i + 1}`).slice(0, 80),
      agent_name: String(t.agent_name || `Specialist ${i + 1}`).slice(0, 40),
      agent_role: String(t.agent_role || 'A focused domain specialist.').slice(0, 300),
      icon: String(t.icon || '🤖').slice(0, 4),
      instructions: String(t.instructions || t.title || ''),
      depends_on: Array.isArray(t.depends_on) ? t.depends_on.map(String) : [],
    };
  });
  // Keep only dependencies on earlier tasks: guarantees an acyclic graph.
  const earlier = new Set();
  for (const t of clean) {
    t.depends_on = [...new Set(t.depends_on.filter((d) => earlier.has(d)))];
    earlier.add(t.id);
  }
  return {
    goal: String(raw?.goal || fallbackGoal),
    strategy: String(raw?.strategy || ''),
    tasks: clean,
  };
}

export async function runOrchestration({ task, apiKey, model = DEFAULT_MODEL, emit, signal }) {
  const opts = { apiKey, signal };
  const usage = { input: 0, output: 0 };
  const addUsage = (u) => {
    usage.input += u.input;
    usage.output += u.output;
    emit({ type: 'usage', usage: { ...usage } });
  };
  const t0 = Date.now();
  emit({ type: 'run_start', task, model, mode: 'live' });

  // ── 1. PLAN ────────────────────────────────────────────────────────────
  emit({ type: 'phase', phase: 'planning' });
  emit({ type: 'agent_start', agent: 'orchestrator' });
  const planned = await callTool(
    {
      model,
      system: PLANNER_SYSTEM,
      messages: [{ role: 'user', content: `Goal:\n${task}` }],
      tool: PLAN_TOOL,
      maxTokens: 3000,
    },
    opts,
  );
  addUsage(planned.usage);
  const plan = sanitizePlan(planned.input, task);
  if (plan.tasks.length === 0) throw new Error('The orchestrator returned an empty plan.');
  emit({ type: 'plan', plan });
  emit({ type: 'agent_done', agent: 'orchestrator' });

  // ── 2. EXECUTE (parallel DAG scheduler) ────────────────────────────────
  emit({ type: 'phase', phase: 'executing' });
  const outputs = {};

  const runTask = async (t, attempt, revision) => {
    emit({ type: 'task_start', taskId: t.id, attempt });
    const started = Date.now();
    const { text, usage: u } = await streamText(
      {
        model,
        system: workerSystem(t),
        messages: [{ role: 'user', content: workerPrompt(plan, t, outputs, revision) }],
        maxTokens: 1800,
        onText: (delta) => emit({ type: 'task_delta', taskId: t.id, text: delta }),
      },
      opts,
    );
    addUsage(u);
    outputs[t.id] = text;
    emit({ type: 'task_done', taskId: t.id, attempt, output: text, usage: u, ms: Date.now() - started });
  };

  await new Promise((resolve, reject) => {
    const status = Object.fromEntries(plan.tasks.map((t) => [t.id, 'pending']));
    let running = 0;
    let failed = false;
    const pump = () => {
      if (failed) return;
      if (plan.tasks.every((t) => status[t.id] === 'done')) return resolve();
      const ready = plan.tasks.filter(
        (t) => status[t.id] === 'pending' && t.depends_on.every((d) => status[d] === 'done'),
      );
      for (const t of ready) {
        if (running >= MAX_PARALLEL) break;
        status[t.id] = 'running';
        running += 1;
        runTask(t, 1)
          .then(() => {
            status[t.id] = 'done';
            running -= 1;
            pump();
          })
          .catch((err) => {
            failed = true;
            reject(err);
          });
      }
    };
    pump();
  });

  // ── 3. REVIEW ──────────────────────────────────────────────────────────
  emit({ type: 'phase', phase: 'reviewing' });
  emit({ type: 'agent_start', agent: 'reviewer' });
  const reviewed = await callTool(
    {
      model,
      system: REVIEWER_SYSTEM,
      messages: [
        {
          role: 'user',
          content:
            `# Overall goal\n${plan.goal}\n\n` +
            plan.tasks
              .map((t) => `## [${t.id}] ${t.agent_name} — ${t.title}\n### Assignment\n${t.instructions}\n### Deliverable\n${outputs[t.id]}`)
              .join('\n\n'),
        },
      ],
      tool: REVIEW_TOOL,
      maxTokens: 2500,
    },
    opts,
  );
  addUsage(reviewed.usage);
  const reviews = plan.tasks.map((t) => {
    const r = (reviewed.input.reviews || []).find((x) => String(x.task_id) === t.id) || {};
    const score = Math.max(1, Math.min(10, Number(r.score) || 8));
    return { taskId: t.id, score, verdict: r.verdict === 'revise' ? 'revise' : 'approve', feedback: String(r.feedback || 'Looks good.') };
  });
  // Cap revisions to the weakest deliverables.
  const toRevise = reviews
    .filter((r) => r.verdict === 'revise')
    .sort((a, b) => a.score - b.score)
    .slice(0, MAX_REVISIONS);
  for (const r of reviews) if (r.verdict === 'revise' && !toRevise.includes(r)) r.verdict = 'approve';
  emit({ type: 'review', overall: String(reviewed.input.overall || ''), reviews });
  emit({ type: 'agent_done', agent: 'reviewer' });

  // ── 4. REVISE ──────────────────────────────────────────────────────────
  if (toRevise.length) {
    emit({ type: 'phase', phase: 'revising' });
    await Promise.all(
      toRevise.map((r) => {
        const t = plan.tasks.find((x) => x.id === r.taskId);
        return runTask(t, 2, { ...r, previous: outputs[t.id] });
      }),
    );
  }

  // ── 5. SYNTHESIZE ──────────────────────────────────────────────────────
  emit({ type: 'phase', phase: 'synthesizing' });
  emit({ type: 'agent_start', agent: 'synthesizer' });
  const synth = await streamText(
    {
      model,
      system: SYNTH_SYSTEM,
      messages: [
        {
          role: 'user',
          content:
            `# Goal\n${plan.goal}\n\n# Deliverables from the team\n\n` +
            plan.tasks.map((t) => `## ${t.agent_name} — ${t.title}\n${outputs[t.id]}`).join('\n\n'),
        },
      ],
      maxTokens: 4000,
      onText: (delta) => emit({ type: 'synth_delta', text: delta }),
    },
    opts,
  );
  addUsage(synth.usage);
  emit({ type: 'agent_done', agent: 'synthesizer', output: synth.text });

  emit({ type: 'phase', phase: 'done' });
  emit({ type: 'run_done', ms: Date.now() - t0, usage });
}
