// @ts-ignore - Asana SDK lacks type declarations
import * as Asana from 'asana';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? 'depl ' + process.env.WEB_REPL_RENEWAL
    : null;

  if (!xReplitToken) {
    throw new Error('X-Replit-Token not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=asana',
    {
      headers: {
        'Accept': 'application/json',
        'X-Replit-Token': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Asana not connected');
  }
  return accessToken;
}

export async function getAsanaApiInstances() {
  const accessToken = await getAccessToken();

  const client = Asana.ApiClient.instance;
  const token = client.authentications['token'];
  token.accessToken = accessToken;

  return {
    tasksApi: new Asana.TasksApi(),
    projectsApi: new Asana.ProjectsApi(),
    usersApi: new Asana.UsersApi(),
    workspacesApi: new Asana.WorkspacesApi()
  };
}

export async function fetchAsanaWorkspaces() {
  const { workspacesApi } = await getAsanaApiInstances();
  const result = await workspacesApi.getWorkspaces({});
  return result?.data || [];
}

export async function fetchAsanaProjects(workspaceGid: string) {
  const { projectsApi } = await getAsanaApiInstances();
  const result = await projectsApi.getProjectsForWorkspace(workspaceGid, {
    opt_fields: 'name,gid,archived'
  });
  return (result?.data || []).filter((p: any) => !p.archived);
}

export async function fetchAsanaTasksFromProject(projectGid: string) {
  const { tasksApi } = await getAsanaApiInstances();
  const allTasks: any[] = [];
  let offset: string | undefined;

  do {
    const opts: any = {
      opt_fields: 'name,gid,due_on,completed,created_at,custom_fields,custom_fields.name,custom_fields.display_value,custom_fields.enum_value,custom_fields.enum_value.name,custom_fields.text_value,custom_fields.number_value,assignee,assignee.name,notes,num_subtasks',
      limit: 100,
    };
    if (offset) opts.offset = offset;

    const result = await tasksApi.getTasksForProject(projectGid, opts);
    if (result?.data) {
      allTasks.push(...result.data);
    }
    offset = result?.next_page?.offset;
  } while (offset);

  return allTasks;
}

export function extractCustomFieldValue(task: any, fieldName: string): string | null {
  if (!task.custom_fields) return null;
  const field = task.custom_fields.find((f: any) =>
    f.name?.toLowerCase().includes(fieldName.toLowerCase())
  );
  if (!field) return null;
  if (field.enum_value?.name) return field.enum_value.name;
  if (field.display_value) return field.display_value;
  if (field.text_value) return field.text_value;
  if (field.number_value !== null && field.number_value !== undefined) return String(field.number_value);
  return null;
}

const FIELD_NAME_MAP: Record<string, string[]> = {
  ucStatus: ['UC TEAM STATUS'],
  ahjStatus: ['AHJ Status.', 'AHJ Status'],
  siteVisitStatus: ['Site visit Request', 'Site visit'],
  contractStatus: ['Contractor'],
  designStatus: ['DESGIN STATUS', 'DESIGN STATUS'],
  pmStatus: ['PM Status'],
  installType: ['Install Type.', 'Install Type'],
};

function findCustomFieldGid(asanaCustomFields: any[], localFieldName: string): string | null {
  const patterns = FIELD_NAME_MAP[localFieldName];
  if (!patterns) return null;
  for (const pattern of patterns) {
    const field = asanaCustomFields.find((f: any) =>
      f.name?.toLowerCase().trim() === pattern.toLowerCase().trim()
    );
    if (field) return field.gid;
  }
  return null;
}

export async function updateAsanaTaskField(taskGid: string, asanaCustomFields: any[], localFieldName: string, newValue: string) {
  const fieldGid = findCustomFieldGid(asanaCustomFields, localFieldName);
  if (!fieldGid) {
    throw new Error(`Could not find Asana custom field for "${localFieldName}"`);
  }

  const accessToken = await getAccessToken();

  const fieldRes = await fetch(`https://app.asana.com/api/1.0/custom_fields/${fieldGid}`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  const fieldData = await fieldRes.json();
  const enumOptions = fieldData?.data?.enum_options || [];

  const matchingOption = enumOptions.find((opt: any) =>
    opt.name?.toLowerCase().trim() === newValue.toLowerCase().trim()
  );

  if (!matchingOption) {
    throw new Error(`Could not find enum option "${newValue}" for field "${localFieldName}". Available: ${enumOptions.map((o: any) => o.name).join(', ')}`);
  }

  const updateRes = await fetch(`https://app.asana.com/api/1.0/tasks/${taskGid}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      data: {
        custom_fields: {
          [fieldGid]: matchingOption.gid,
        }
      }
    }),
  });

  if (!updateRes.ok) {
    const errBody = await updateRes.text();
    throw new Error(`Asana update failed: ${updateRes.status} ${errBody}`);
  }

  return await updateRes.json();
}

export async function getAsanaEnumOptions(asanaCustomFields: any[], localFieldName: string): Promise<{ gid: string; name: string }[]> {
  const fieldGid = findCustomFieldGid(asanaCustomFields, localFieldName);
  if (!fieldGid) return [];

  const accessToken = await getAccessToken();
  const fieldRes = await fetch(`https://app.asana.com/api/1.0/custom_fields/${fieldGid}`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  const fieldData = await fieldRes.json();
  const enumOptions = fieldData?.data?.enum_options || [];
  return enumOptions
    .filter((opt: any) => opt.enabled !== false)
    .map((opt: any) => ({ gid: opt.gid, name: opt.name }));
}

export function mapAsanaTaskToProject(task: any) {
  return {
    asanaGid: task.gid,
    name: task.name || 'Unnamed Project',
    installType: extractCustomFieldValue(task, 'install type') || extractCustomFieldValue(task, 'install typ'),
    pmStatus: extractCustomFieldValue(task, 'pm status'),
    ucStatus: extractCustomFieldValue(task, 'uc team') || extractCustomFieldValue(task, 'uc status'),
    ahjStatus: extractCustomFieldValue(task, 'ahj status') || extractCustomFieldValue(task, 'ahj'),
    designStatus: extractCustomFieldValue(task, 'design') || extractCustomFieldValue(task, 'desgin'),
    quotingStatus: extractCustomFieldValue(task, 'quoting'),
    province: extractCustomFieldValue(task, 'province'),
    asanaDueDate: task.due_on || null,
    paymentMethod: extractCustomFieldValue(task, 'payment') || extractCustomFieldValue(task, 'pay'),
    rebateStatus: extractCustomFieldValue(task, 'rebate'),
    contractStatus: extractCustomFieldValue(task, 'contract'),
    siteVisitStatus: extractCustomFieldValue(task, 'site visit'),
    projectCreatedDate: task.created_at ? task.created_at.split('T')[0] : null,
    asanaCustomFields: task.custom_fields || [],
  };
}
