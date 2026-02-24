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
      opt_fields: 'name,gid,due_on,completed,custom_fields,custom_fields.name,custom_fields.display_value,custom_fields.enum_value,custom_fields.enum_value.name,custom_fields.text_value,custom_fields.number_value,assignee,assignee.name,notes,num_subtasks',
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
    asanaCustomFields: task.custom_fields || [],
  };
}
