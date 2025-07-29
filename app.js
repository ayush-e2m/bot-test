require('dotenv').config();
const { App } = require('@slack/bolt');
const fetch = require('node-fetch'); // For Node <18, else remove if using Node 18+

const SERVICE_OPTIONS = [
  { text: { type: 'plain_text', text: 'Messaging' }, value: 'Messaging' },
  { text: { type: 'plain_text', text: 'Advertisement' }, value: 'Advertisement' },
  { text: { type: 'plain_text', text: 'Naming' }, value: 'Naming' },
  { text: { type: 'plain_text', text: 'Strategy' }, value: 'Strategy' }, // Added
  // Add more services here if you need
];

const SERVICE_QUESTIONS = {
  Messaging: [
    {
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
    {
      type: 'input',
      block_id: 'messaging_client_materials_block',
      label: { type: 'plain_text', text: 'Messaging: How many client materials to review?' },
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
    {
      type: 'input',
      block_id: 'messaging_competitors_analyze_block',
      label: { type: 'plain_text', text: 'Messaging: How many competitors to analyze?' },
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
    {
      type: 'input',
      block_id: 'messaging_strategy_session_block',
      label: { type: 'plain_text', text: 'Messaging: How long of a strategy work session is required?' },
      element: {
        type: 'static_select',
        action_id: 'strategy_session',
        options: [
          { text: { type: 'plain_text', text: '60 minutes' }, value: '60 minutes' },
          { text: { type: 'plain_text', text: '1.5 hours' }, value: '1.5 hours' },
          { text: { type: 'plain_text', text: '4 hours' }, value: '4 hours' },
        ],
      },
    },
    {
      type: 'input',
      block_id: 'messaging_review_rounds_block',
      label: { type: 'plain_text', text: 'Messaging: How many rounds of review?' },
      element: {
        type: 'static_select',
        action_id: 'review_rounds',
        options: [
          { text: { type: 'plain_text', text: 'None' }, value: 'None' },
          { text: { type: 'plain_text', text: 'One' }, value: 'One' },
          { text: { type: 'plain_text', text: 'Two' }, value: 'Two' },
          { text: { type: 'plain_text', text: 'Three' }, value: 'Three' },
        ],
      },
    },
    {
      type: 'input',
      block_id: 'messaging_immersion_call_duration_block',
      label: { type: 'plain_text', text: 'What duration would you prefer for the immersion call?' },
      element: {
        type: 'static_select',
        action_id: 'immersion_call_duration',
        options: [
          { text: { type: 'plain_text', text: '60 mins' }, value: '60 mins' },
          { text: { type: 'plain_text', text: '90 mins' }, value: '90 mins' },
          { text: { type: 'plain_text', text: '120 mins' }, value: '120 mins' },
        ],
      },
    },
    {
      type: 'input',
      block_id: 'messaging_virtual_strategic_session_block',
      label: { type: 'plain_text', text: 'How many virtual strategic sessions?' },
      element: {
        type: 'static_select',
        action_id: 'virtual_strategic_session',
        options: [
          { text: { type: 'plain_text', text: 'One' }, value: 'One' },
          { text: { type: 'plain_text', text: 'Two' }, value: 'Two' },
          { text: { type: 'plain_text', text: 'Three' }, value: 'Three' },
        ],
      },
    },
  ],
  Advertisement: [
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
  ],
  Naming: [
    {
      type: 'input',
      block_id: 'naming_client_materials_block',
      label: { type: 'plain_text', text: 'Naming: How many client materials to review?' },
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
    {
      type: 'input',
      block_id: 'naming_stakeholders_interview_block',
      label: { type: 'plain_text', text: 'Naming: How many stakeholders to interview?' },
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
    {
      type: 'input',
      block_id: 'naming_competitors_analyze_block',
      label: { type: 'plain_text', text: 'Naming: How many competitors to analyze?' },
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
    {
      type: 'input',
      block_id: 'naming_creative_territories_block',
      label: { type: 'plain_text', text: 'Naming: How many unique creative naming territories?' },
      element: {
        type: 'static_select',
        action_id: 'creative_territories',
        options: [
          { text: { type: 'plain_text', text: '2' }, value: '2' },
          { text: { type: 'plain_text', text: '4' }, value: '4' },
          { text: { type: 'plain_text', text: '6' }, value: '6' },
        ],
      },
    },
    {
      type: 'input',
      block_id: 'naming_options_block',
      label: { type: 'plain_text', text: 'Naming: How many naming options?' },
      element: {
        type: 'static_select',
        action_id: 'naming_options',
        options: [
          { text: { type: 'plain_text', text: '100' }, value: '100' },
          { text: { type: 'plain_text', text: '200' }, value: '200' },
          { text: { type: 'plain_text', text: '300' }, value: '300' },
          { text: { type: 'plain_text', text: '400' }, value: '400' },
        ],
      },
    },
    {
      type: 'input',
      block_id: 'naming_prescreened_candidates_block',
      label: { type: 'plain_text', text: 'Naming: How many pre-screened name candidates?' },
      element: {
        type: 'static_select',
        action_id: 'prescreened_candidates',
        options: [
          { text: { type: 'plain_text', text: '10' }, value: '10' },
          { text: { type: 'plain_text', text: '20' }, value: '20' },
          { text: { type: 'plain_text', text: '30' }, value: '30' },
        ],
      },
    },
    {
      type: 'input',
      block_id: 'naming_legal_vetted_block',
      label: { type: 'plain_text', text: 'Naming: How many shortlist name candidates are legally vetted?' },
      element: {
        type: 'static_select',
        action_id: 'legal_vetted',
        options: [
          { text: { type: 'plain_text', text: '3' }, value: '3' },
          { text: { type: 'plain_text', text: '6' }, value: '6' },
          { text: { type: 'plain_text', text: '8' }, value: '8' },
          { text: { type: 'plain_text', text: '10' }, value: '10' },
        ],
      },
    },
    {
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
    {
      type: 'input',
      block_id: 'naming_shortlist_legal_vetting_block',
      label: { type: 'plain_text', text: 'Naming: How many shortlist name candidates for legal vetting?' },
      element: {
        type: 'static_select',
        action_id: 'shortlist_legal_vetting',
        options: [
          { text: { type: 'plain_text', text: '30' }, value: '30' },
          { text: { type: 'plain_text', text: '50' }, value: '50' },
          { text: { type: 'plain_text', text: '70' }, value: '70' },
          { text: { type: 'plain_text', text: '100' }, value: '100' },
        ],
      },
    },
  ],
  Strategy: [
    {
      type: 'input',
      block_id: 'strategy_complexity_level_block',
      label: { type: 'plain_text', text: 'Complexity Level' },
      element: {
        type: 'static_select',
        action_id: 'complexity_level',
        options: [
          { text: { type: 'plain_text', text: 'Tier 1' }, value: 'Tier 1' },
        ],
      },
    },
    {
      type: 'input',
      block_id: 'strategy_client_materials_block',
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
    {
      type: 'input',
      block_id: 'strategy_competitors_analyze_block',
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
    {
      type: 'input',
      block_id: 'strategy_stakeholders_interview_block',
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
  ],
  // ...other services...
};

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
          {
            type: 'header',
            text: { type: 'plain_text', text: 'Submitting Details' },
          },
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

app.view('service_intro_modal', async ({ ack, view, body, client }) => {
  const values = view.state.values;
  const companyName = values.company_name_block.company_name.value;
  const projectName = values.project_name_block.project_name.value;
  const date = values.date_block.date.selected_date;
  const selectedServices = values.services_block.services.selected_options.map(opt => opt.value);

  // Validation
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

  // Prepare service questions
  let serviceBlocks = [];
  selectedServices.forEach(service => {
    if (SERVICE_QUESTIONS[service]) {
      serviceBlocks = serviceBlocks.concat(SERVICE_QUESTIONS[service]);
    }
  });

  await ack({
    response_action: 'update',
    view: {
      type: 'modal',
      callback_id: 'service_details_modal',
      title: { type: 'plain_text', text: 'Service Details' },
      submit: { type: 'plain_text', text: 'Submit' },
      close: { type: 'plain_text', text: 'Cancel' },
      private_metadata: JSON.stringify({
        companyName,
        projectName,
        date,
        selectedServices,
      }),
      blocks: [
        {
          type: 'section',
          text: { type: 'plain_text', text: `Company: ${companyName}\nProject: ${projectName}\nDate: ${date}\nServices: ${selectedServices.join(', ')}` },
        },
        ...serviceBlocks,
      ],
    },
  });
});

app.view('service_details_modal', async ({ ack, view, body }) => {
  await ack();

  const { companyName, projectName, date, selectedServices } = JSON.parse(view.private_metadata || '{}');
  const values = view.state.values;

  let result = {
    user: body.user.id,
    company_name: companyName,
    project_name: projectName,
    date,
    selected_services: selectedServices,
    service_details: {},
  };

  selectedServices.forEach(service => {
    result.service_details[service] = {};
    (SERVICE_QUESTIONS[service] || []).forEach(block => {
      const block_id = block.block_id;
      const element = block.element;
      let answer;
      try {
        if (element.type === 'static_select') {
          answer = values[block_id][element.action_id]?.selected_option?.value;
        } else if (element.type === 'multi_static_select') {
          answer = (values[block_id][element.action_id]?.selected_options || []).map(opt => opt.value);
        } else if (element.type === 'plain_text_input') {
          answer = values[block_id][element.action_id]?.value;
        } else if (element.type === 'datepicker') {
          answer = values[block_id][element.action_id]?.selected_date;
        }
      } catch (e) {}
      result.service_details[service][block_id] = answer;
    });
  });

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
