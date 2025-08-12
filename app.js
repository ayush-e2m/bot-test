require('dotenv').config();
const { App } = require('@slack/bolt');
const fetch = require('node-fetch'); // For Node <18, else remove if using Node 18+

/** -----------------------------
 * Services list (unchanged)
 * ----------------------------- */
const SERVICES = ['Messaging', 'Advertisement', 'Naming', 'Strategy'];

const SERVICE_OPTIONS = SERVICES.map(s => ({
  text: { type: 'plain_text', text: s },
  value: s,
}));

/** -----------------------------
 * Question registry
 * -----------------------------
 * Rule: Only "Complexity Level" is per-service unique.
 * All other questions live once, with `appliesTo` listing services that use it.
 * `id` must be globally unique across all questions in this registry.
 * For service-unique questions (complexity), we generate them dynamically.
 */
const COMMON_QUESTIONS = [
  {
    id: 'client_materials',
    appliesTo: ['Messaging', 'Naming', 'Strategy'],
    label: 'How many client materials to review?',
    type: 'static_select',
    options: ['3', '5', '10', '15'],
  },
  {
    id: 'competitors_analyze',
    appliesTo: ['Messaging', 'Naming', 'Strategy'],
    label: 'How many competitors to analyze?',
    type: 'static_select',
    options: ['2', '3', '5', '8'],
  },
  {
    id: 'stakeholders_interview',
    appliesTo: ['Naming', 'Strategy'],
    label: 'How many stakeholders to interview?',
    type: 'static_select',
    options: ['4', '8', '12', '20'],
  },

  /** Messaging-only (non-complexity) */
  {
    id: 'messaging_strategy_session',
    appliesTo: ['Messaging'],
    label: 'Messaging: How long of a strategy work session is required?',
    type: 'static_select',
    options: ['60 minutes', '1.5 hours', '4 hours'],
  },
  {
    id: 'messaging_review_rounds',
    appliesTo: ['Messaging'],
    label: 'Messaging: How many rounds of review?',
    type: 'static_select',
    options: ['None', 'One', 'Two', 'Three'],
  },
  {
    id: 'messaging_immersion_call_duration',
    appliesTo: ['Messaging'],
    label: 'What duration would you prefer for the immersion call?',
    type: 'static_select',
    options: ['60 mins', '90 mins', '120 mins'],
  },
  {
    id: 'messaging_virtual_strategic_session',
    appliesTo: ['Messaging'],
    label: 'How many virtual strategic sessions?',
    type: 'static_select',
    options: ['One', 'Two', 'Three'],
  },

  /** Naming-only (non-complexity) */
  {
    id: 'naming_creative_territories',
    appliesTo: ['Naming'],
    label: 'Naming: How many unique creative naming territories?',
    type: 'static_select',
    options: ['2', '4', '6'],
  },
  {
    id: 'naming_options',
    appliesTo: ['Naming'],
    label: 'Naming: How many naming options?',
    type: 'static_select',
    options: ['100', '200', '300', '400'],
  },
  {
    id: 'naming_prescreened_candidates',
    appliesTo: ['Naming'],
    label: 'Naming: How many pre-screened name candidates?',
    type: 'static_select',
    options: ['10', '20', '30'],
  },
  {
    id: 'naming_legal_vetted',
    appliesTo: ['Naming'],
    label: 'Naming: How many shortlist name candidates are legally vetted?',
    type: 'static_select',
    options: ['3', '6', '8', '10'],
  },
  {
    id: 'naming_shortlist_legal_vetting',
    appliesTo: ['Naming'],
    label: 'Naming: How many shortlist name candidates for legal vetting?',
    type: 'static_select',
    options: ['30', '50', '70', '100'],
  },

  /** Advertisement-only (no overlaps) */
  {
    id: 'advertisement_platforms',
    appliesTo: ['Advertisement'],
    label: 'Advertisement: Platforms',
    type: 'multi_static_select',
    options: ['Google Ads', 'Facebook', 'Instagram', 'LinkedIn', 'Other'],
  },
  {
    id: 'advertisement_budget',
    appliesTo: ['Advertisement'],
    label: 'Advertisement: What is your budget?',
    type: 'plain_text_input',
    placeholder: 'e.g. $5000/month',
  },
  {
    id: 'advertisement_duration',
    appliesTo: ['Advertisement'],
    label: 'Advertisement: Campaign Duration (weeks)',
    type: 'static_select',
    options: ['2 weeks', '4 weeks', '8 weeks'],
  },
];

/** Build a Slack block for a single question descriptor */
function buildBlockFromQuestion(q) {
  const block_id = `${q.id}_block`;

  // element (by type)
  let element;
  if (q.type === 'static_select') {
    element = {
      type: 'static_select',
      action_id: q.id,
      options: q.options.map(o => ({ text: { type: 'plain_text', text: o }, value: o })),
      placeholder: { type: 'plain_text', text: 'Select…' },
    };
  } else if (q.type === 'multi_static_select') {
    element = {
      type: 'multi_static_select',
      action_id: q.id,
      options: q.options.map(o => ({ text: { type: 'plain_text', text: o }, value: o })),
      placeholder: { type: 'plain_text', text: 'Select one or more…' },
    };
  } else if (q.type === 'plain_text_input') {
    element = {
      type: 'plain_text_input',
      action_id: q.id,
      placeholder: q.placeholder ? { type: 'plain_text', text: q.placeholder } : undefined,
    };
  } else {
    throw new Error(`Unsupported question type: ${q.type}`);
  }

  return {
    type: 'input',
    block_id,
    label: { type: 'plain_text', text: q.label },
    element,
  };
}

/** Build the unique complexity block for a given service */
function buildComplexityBlock(service) {
  return {
    type: 'input',
    block_id: `${service.toLowerCase()}_complexity_level_block`,
    label: { type: 'plain_text', text: `${service}: Complexity Level` },
    element: {
      type: 'static_select',
      action_id: 'complexity_level',
      options: [
        { text: { type: 'plain_text', text: 'Light' }, value: 'Light' },
        { text: { type: 'plain_text', text: 'Medium' }, value: 'Medium' },
        { text: { type: 'plain_text', text: 'Large' }, value: 'Large' },
      ],
    },
  };
}

/** -----------------------------
 * Slack app
 * ----------------------------- */
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
});

app.command('/service', async ({ ack, body, client }) => {
  await ack();
  try {
    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: 'modal',
        callback_id: 'service_intro_modal',
        title: { type: 'plain_text', text: 'Project Kickoff' },
        submit: { type: 'plain_text', text: 'Next' },
        close: { type: 'plain_text', text: 'Cancel' },
        blocks: [
          { type: 'header', text: { type: 'plain_text', text: 'Submitting Details' } },
          {
            type: 'input',
            block_id: 'company_name_block',
            label: { type: 'plain_text', text: 'Company Name' },
            element: {
              type: 'plain_text_input',
              action_id: 'company_name',
              placeholder: { type: 'plain_text', text: 'Enter company name' },
            },
          },
          {
            type: 'input',
            block_id: 'project_name_block',
            label: { type: 'plain_text', text: 'Project Name' },
            element: {
              type: 'plain_text_input',
              action_id: 'project_name',
              placeholder: { type: 'plain_text', text: 'Enter project name' },
            },
          },
          {
            type: 'input',
            block_id: 'date_block',
            label: { type: 'plain_text', text: 'Date' },
            element: {
              type: 'datepicker',
              action_id: 'date',
              placeholder: { type: 'plain_text', text: 'Select a date' },
            },
          },
          {
            type: 'input',
            block_id: 'services_block',
            label: { type: 'plain_text', text: 'Services We Offer' },
            element: {
              type: 'multi_static_select',
              action_id: 'services',
              options: SERVICE_OPTIONS,
            },
          },
        ],
      },
    });
  } catch (error) {
    console.error('Error opening service intro modal:', error);
  }
});

app.view('service_intro_modal', async ({ ack, view, client }) => {
  const values = view.state.values;
  const companyName = values.company_name_block.company_name.value;
  const projectName = values.project_name_block.project_name.value;
  const date = values.date_block.date.selected_date;
  const selectedServices =
    values.services_block.services.selected_options.map(opt => opt.value);

  if (!companyName || !projectName || !date || selectedServices.length === 0) {
    await ack({
      response_action: 'errors',
      errors: {
        company_name_block: !companyName ? 'Company name is required' : undefined,
        project_name_block: !projectName ? 'Project name is required' : undefined,
        date_block: !date ? 'Please select a date' : undefined,
        services_block: selectedServices.length === 0 ? 'Select at least one service' : undefined,
      },
    });
    return;
  }

  // Build blocks:
  // 1) Per-service complexity (unique)
  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Company:* ${companyName}\n*Project:* ${projectName}\n*Date:* ${date}\n*Services:* ${selectedServices.join(', ')}`,
      },
    },
  ];

  selectedServices.forEach(svc => {
    blocks.push({ type: 'divider' });
    blocks.push({ type: 'header', text: { type: 'plain_text', text: `${svc} · Complexity` } });
    blocks.push(buildComplexityBlock(svc));
  });

  // 2) Shared/common questions: include each question ONCE if it applies to any selected service
  const visibleCommon = COMMON_QUESTIONS.filter(q =>
    q.appliesTo.some(svc => selectedServices.includes(svc))
  );

  if (visibleCommon.length > 0) {
    blocks.push({ type: 'divider' });
    blocks.push({ type: 'header', text: { type: 'plain_text', text: 'Shared Questions' } });
    visibleCommon.forEach(q => blocks.push(buildBlockFromQuestion(q)));
  }

  await ack({
    response_action: 'update',
    view: {
      type: 'modal',
      callback_id: 'service_details_modal',
      title: { type: 'plain_text', text: 'Service Details' },
      submit: { type: 'plain_text', text: 'Submit' },
      close: { type: 'plain_text', text: 'Cancel' },
      private_metadata: JSON.stringify({ companyName, projectName, date, selectedServices }),
      blocks,
    },
  });
});

app.view('service_details_modal', async ({ ack, view, body }) => {
  await ack();

  const { companyName, projectName, date, selectedServices } = JSON.parse(view.private_metadata || '{}');
  const values = view.state.values;

  const result = {
    user: body.user.id,
    company_name: companyName,
    project_name: projectName,
    date,
    selected_services: selectedServices,
    service_details: {},
  };

  // 1) Read per-service complexity answers
  selectedServices.forEach(service => {
    const blockId = `${service.toLowerCase()}_complexity_level_block`;
    const complexity =
      values[blockId]?.complexity_level?.selected_option?.value || null;

    result.service_details[service] = {
      complexity_level: complexity,
    };
  });

  // 2) Read each visible shared question ONCE and fan out to all services that use it
  COMMON_QUESTIONS.forEach(q => {
    // Was this question shown? (block present?)
    const blockId = `${q.id}_block`;
    if (!values[blockId]) return; // not shown due to service selection

    let answer;
    const el = values[blockId][q.id];

    if (q.type === 'static_select') {
      answer = el?.selected_option?.value || null;
    } else if (q.type === 'multi_static_select') {
      answer = (el?.selected_options || []).map(o => o.value);
    } else if (q.type === 'plain_text_input') {
      answer = el?.value || null;
    }

    // Assign to every selected service that this question applies to
    selectedServices.forEach(svc => {
      if (!q.appliesTo.includes(svc)) return;
      if (!result.service_details[svc]) result.service_details[svc] = {};
      result.service_details[svc][q.id] = answer;
    });
  });

  // Send to your webhook (unchanged)
  try {
    const response = await fetch('https://n8n.sitepreviews.dev/webhook/b9223a9e-8b4a-4235-8b5f-144fcf3f27a4', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result),
    });
    const respText = await response.text();
    console.log('Webhook response:', respText);
  } catch (error) {
    console.error('Error sending data to webhook:', error);
  }
});

(async () => {
  await app.start(process.env.PORT || 3000);
  console.log('⚡️ Slack Bolt app is running!');
})();
