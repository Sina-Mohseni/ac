import { S } from './state.js';
import { setNav, refreshCurrents, renderFooter } from './ui.js';
import { get, groupPath } from './db.js';
import { viewGroup } from './views/library.js';
import { viewProject } from './views/project.js';
import { viewTracker } from './views/tracker.js';
import { viewGuild, viewHourglass, viewSphere } from './views/guild.js';
import { viewPersonas } from './views/sheet.js';
import { viewSubjects } from './views/subjects.js';
import { viewScenario } from './views/scenario.js';
import { viewEye, viewGates, viewSession } from './views/live.js';
import { viewExperience, viewVault, viewMusic, viewSettings } from './views/pages.js';

const VIEWS = {
  guild: viewGuild,
  personas: viewPersonas,
  subjects: viewSubjects,
  scenario: viewScenario,
  eye: viewEye,
  gates: viewGates,
  session: viewSession,
  hourglass: viewHourglass,
  sphere: viewSphere,
  group: viewGroup,
  project: viewProject,
  tracker: viewTracker,
  music: viewMusic,
  settings: viewSettings,
  experience: viewExperience,
  vault: viewVault
};

export async function render() {
  /* « library » n'est plus une vue à part : c'est une salle de la Guilde.
     « profiles » a fusionné avec les personas. */
  if (S.view === 'library') { S.view = 'tracker'; S.trackTab = 'library'; }
  if (S.view === 'profiles') S.view = 'personas';
  setNav(S.view);
  renderFooter();
  const fn = VIEWS[S.view] || viewGuild;
  await fn();
  await refreshCurrents();
  window.scrollTo({ top: 0 });
}

/* remonte d'un cran : projet → son groupe, groupe → son parent,
   salle → Guilde, Guilde → Guilde */
export async function goBack() {
  if (S.view === 'experience') {
    S.view = S.projectId ? 'project' : (S.groupId ? 'group' : 'tracker');
    if (S.view === 'tracker') S.trackTab = 'library';
    return render();
  }
  if (S.view === 'project') {
    const p = await get('projects', S.projectId);
    S.projectId = null;
    if (p && p.groupId) { S.groupId = p.groupId; S.view = 'group'; }
    else {
      S.groupId = null; S.view = 'tracker'; S.trackTab = 'library';
      S.activeRootId = null; S.branchMode = null;
    }
    return render();
  }
  if (S.view === 'group') {
    const path = await groupPath(S.groupId);
    const parent = path.length > 1 ? path[path.length - 2] : null;
    if (parent) { S.groupId = parent.id; }
    else {
      S.groupId = null; S.view = 'tracker'; S.trackTab = 'library';
      S.activeRootId = null; S.branchMode = null;
    }
    return render();
  }
  S.view = 'guild';
  S.groupId = null;
  S.projectId = null;
  S.activeRootId = null;
  S.branchMode = null;
  return render();
}
