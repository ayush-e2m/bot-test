require('dotenv').config();
const { App } = require('@slack/bolt');
const fetch = require('node-fetch'); // For Node <18, else remove if using Node 18+

// -----------------------------------------------------------------------------
// Service lists
// -----------------------------------------------------------------------------
const SERVICE_OPTIONS = [
  { text: { type: 'plain_text', text: 'Messaging' }, value: 'Messaging' },
  { text: { type: 'plain_text', text: 'Advertisement' }, value: 'Advertisement' },
  { text: { type: 'plain_text', text: 'Naming' }, value: 'Naming' },
  { text: { type: 'plain_text', text: 'Strategy' }, value: 'Strategy' },
];

// Services that participate in each shared question
const SHARED_Q_APPLIES = {
  client_materials: new Set(['Messaging', 'Naming', 'Strategy']),
  competitors_analyze: new Set(['Messaging', 'Naming', 'Strategy']),
  stakeholders_interview: new Set(['Naming', 'Strategy']),
};

// -----------------------------------------------------------------------------
// Complexity blocks (unique per service)
// -----------------------------------------------------------------------------
const SERVICE_COMPLEXITY_BLOCKS = {
  Messaging: {
    type: 'input',
    block_id: 'messaging_complexity_level_block',
    label: { type: 'plain_text', text: 'Messaging: Complexity Level' },
    element: {
      type: 'static_select',
      action_id: 'complexity_level',
      options: [
        { text: { type: 'plain_text', text: 'Tier 1' }, value: 'Tier 1' },
        { text: { type: 'plain_text', text: 'Tier 2' }, value: 'Tier 2' },
        { text: { type: 'plain_text', text: 'Tier 3' }, value: 'Tier 3' },
      ],
    },
  },
  Naming: {
    type: 'input',
    block_id: 'naming_complexity_level_block',
    label: { type: 'plain_text', text: 'Naming: Complexity Level' },
    element: {
      type: 'static_select',
      action_id: 'complexity_level',
      options: [
        { text: { type: 'plain_text', text: 'Tier 1' }, value: 'Tier 1' },
        { text: { type: 'plain_text', text: 'Tier 2' }, value: 'Tier 2' },
        { text: { type: 'plain_text', text: 'Tier 3' }, value: 'Tier 3' },
      ],
    },
  },
  Strategy: {
    type: 'input',
    block_id: 'strategy_complexity_level_block',
    label: { type: 'plain_text', text: 'Strategy: Complexity Level' },
    element: {
      type: 'static_select',
      action_id: 'complexity_level',
      options: [
        { text: { type: 'plain_text', text: 'Tier 1' }, value: 'Tier 1' },
      ],
    },
  },
  // Advertisement has no complexity in your original spec; leave it out
};

// -----------------------------------------------------------------------------
// Shared (deduplicated) question blocks (added once if applicable)
// -----------------------------------------------------------------------------
const SHARED_BLOCKS = {
  client_materials: {
    type: 'input',
    block_id: 'shared_client_materials_block',
    label: { type: 'plain_text', text: 'How many client materials to review?' },
    element: {
      type: 'static_select',
      action_id: 'client_materials',
      options: [
        { text: { type: 'plain_text', text: '3' }, value: '3' },
        { text: { type: 'plain_text', text: '5' }, value: '5' },
        { text: { type: 'plain_text', text: '10' }, value: '10' },
        { text: { type: 'plain_text', text: '15' }, value: '15' },
      ],
    },
  },
  competitors_analyze: {
    type: 'input',
    block_id: 'shared_competitors_analyze_block',
    label: { type: 'plain_text', text: 'How many competitors to analyze?' },
    element: {
      type: 'static_select',
      action_id: 'competitors_analyze',
      options: [
        { text: { type: 'plain_text', text: '2' }, value: '2' },
        { text: { type: 'plain_text', text: '3' }, value: '3' },
        { text: { type: 'plain_text', text: '5' }, value: '5' },
        { text: { type: 'plain_text', text: '8' }, value: '8' },
      ],
    },
  },
  stakeholders_interview: {
    type: 'input',
    block_id: 'shared_stakeholders_interview_block',
    label: { type: 'plain_text', text: 'How many stakeholders to interview?' },
    element: {
      type: 'static_select',
      action_id: 'stakeholders_interview',
      options: [
        { text: { type: 'plain_text', text: '4' }, value: '4' },
        { text: { type: 'plain_text', text: '8' }, value: '8' },
        { text: { type: 'plain_text', text: '12' }, value: '12' },
        { text: { type: 'plain_text', text: '20' }, value: '20' },
      ],
    },
  },
};

// -----------------------------------------------------------------------------
// Advertisement blocks (kept as-is since they’re unique to that service)
// -----------------------------------------------------------------------------
const ADVERTISEMENT_BLOCKS = [
  {
    type: 'input',
    block_id: 'advertisement_platform_block',
    label: { type: 'plain_text', text: 'Advertisement: Platforms' },
    element: {
      type: 'multi_static_select',
      action_id: 'platforms',
      options: [
        { text: { type: 'plain_text', text: 'Google Ads' }, value: 'Google Ads' },
        { text: { type: 'plain_text', text: 'Facebook' }, value: 'Facebook' },
        { text: { type: 'plain_text', text: 'Instagram' }, value: 'Instagram' },
        { text: { type: 'plain_text', text: 'LinkedIn' }, value: 'LinkedIn' },
        { text: { type: 'plain_text', text: 'Other' }, value: 'Other' },
      ],
    },
  },
  {
    type: 'input',
    block_id: 'advertisement_budget_block',
    label: { type: 'plain_text', text: 'Advertisement: What is your budget?' },
    element: {
      type: 'plain_text_input',
      action_id: 'budget',
      placeholder: { type: 'plain_text', text: 'e.g. $5000/month' },
    },
  },
  {
    type: 'input',
    block_id: 'advertisement_duration_block',
    label: { type: 'plain_text', text: 'Advertisement: Campaign Duration (weeks)' },
    element: {
      type: 'static_select',
      action_id: 'duration',
      options: [
        { text: { type: 'plain_text', text: '2 weeks' }, value: '2 weeks' },
        { text: { type: 'plain_text', text: '4 weeks' }, value: '4 weeks' },
        { text: { type: 'plain_text', text: '8 weeks' }, value: '8 weeks' },
      ],
    },
  },
];

// -----------------------------------------------------------------------------
// Bolt app
// -----------------------------------------------------------------------------
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
});

// First screen (unchanged)
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

// Build deduped second screen
app.view('service_intro_modal', async ({ ack, view, body, client }) => {
  const values = view.state.values;
  const companyName = values.company_name_block.company_name.value;
  const projectName = values.project_name_block.project_name.value;
  const date = values.date_block.date.selected_date;
  const selectedServices =
    values.services_block.services.selected_options.map((opt) => opt.value);

  // Validation
  if (!companyName || !projectName || !date || selectedServices.length === 0) {
    await ack({
      response_action: 'errors',
      errors: {
        company_name_block: !companyName ? 'Company name is required' : undefined,
        project_name_block: !projectName ? 'Project name is required' : undefined,
        date_block: !date ? 'Please select a date' : undefined,
        services_block:
          selectedServices.length === 0 ? 'Select at least one service' : undefined,
      },
    });
    return;
  }

  // Complexity blocks (unique per selected service)
  const complexityBlocks = selectedServices
    .filter((svc) => SERVICE_COMPLEXITY_BLOCKS[svc])
    .map((svc) => SERVICE_COMPLEXITY_BLOCKS[svc]);

  // Shared blocks (added once if any selected service qualifies)
  const addClientMaterials =
    selectedServices.some((s) => SHARED_Q_APPLIES.client_materials.has(s));
  const addCompetitors =
    selectedServices.some((s) => SHARED_Q_APPLIES.competitors_analyze.has(s));
  const addStakeholders =
    selectedServices.some((s) => SHARED_Q_APPLIES.stakeholders_interview.has(s));

  const sharedBlocks = [];
  if (addClientMaterials) sharedBlocks.push(SHARED_BLOCKS.client_materials);
  if (addCompetitors) sharedBlocks.push(SHARED_BLOCKS.competitors_analyze);
  if (addStakeholders) sharedBlocks.push(SHARED_BLOCKS.stakeholders_interview);

  // Advertisement-specific blocks (if Advertisement selected)
  const adsBlocks = selectedServices.includes('Advertisement')
    ? ADVERTISEMENT_BLOCKS
    : [];

  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text:
          `*Company:* ${companyName}\n` +
          `*Project:* ${projectName}\n` +
          `*Date:* ${date}\n` +
          `*Services:* ${selectedServices.join(', ')}`,
      },
    },
    ...complexityBlocks,
    ...sharedBlocks,
    ...adsBlocks,
  ];

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

// Submit handler: extract complexity per service + shared answers once
app.view('service_details_modal', async ({ ack, view, body }) => {
  await ack();

  const { companyName, projectName, date, selectedServices } = JSON.parse(
    view.private_metadata || '{}'
  );
  const values = view.state.values;

  const result = {
    user: body.user.id,
    company_name: companyName,
    project_name: projectName,
    date,
    selected_services: selectedServices,
    service_details: {},     // complexity per service
    shared_details: {},      // shared answers once
    advertisement_details: {}, // if applicable
  };

  // Extract complexity per service (if present)
  selectedServices.forEach((service) => {
    result.service_details[service] = {};
    const cBlock = SERVICE_COMPLEXITY_BLOCKS[service];
    if (cBlock) {
      const blockId = cBlock.block_id;
      const actionId = cBlock.element.action_id; // 'complexity_level'
      const answer = values?.[blockId]?.[actionId]?.selected_option?.value;
      result.service_details[service].complexity_level = answer ?? null;
    }
  });

  // Extract shared answers (if present)
  if (values.shared_client_materials_block?.client_materials) {
    result.shared_details.client_materials =
      values.shared_client_materials_block.client_materials.selected_option?.value || null;
  }
  if (values.shared_competitors_analyze_block?.competitors_analyze) {
    result.shared_details.competitors_analyze =
      values.shared_competitors_analyze_block.competitors_analyze.selected_option?.value || null;
  }
  if (values.shared_stakeholders_interview_block?.stakeholders_interview) {
    result.shared_details.stakeholders_interview =
      values.shared_stakeholders_interview_block.stakeholders_interview.selected_option?.value || null;
  }

  // Extract Advertisement details (if present)
  if (selectedServices.includes('Advertisement')) {
    const platforms =
      values.advertisement_platform_block?.platforms?.selected_options?.map((o) => o.value) || [];
    const budget = values.advertisement_budget_block?.budget?.value || null;
    const duration =
      values.advertisement_duration_block?.duration?.selected_option?.value || null;
    result.advertisement_details = { platforms, budget, duration };
  }

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
