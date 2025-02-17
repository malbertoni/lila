import { h } from 'snabbdom'
import { VNode } from 'snabbdom/vnode'
import { bind, dataIcon, iconTag } from '../util';
import { view as memberView } from './studyMembers';
import { view as chapterView } from './studyChapters';
import { view as chapterNewFormView } from './chapterNewForm';
import { view as chapterEditFormView } from './chapterEditForm';
import * as commentForm from './commentForm';
import * as glyphForm from './studyGlyph';
import { view as inviteFormView } from './inviteForm';
import { view as studyFormView } from './studyForm';
import { view as studyShareView } from './studyShare';
import { view as multiBoardView } from './multiBoard';
import { view as notifView } from './notif';
import { view as tagsView } from './studyTags';
import { view as serverEvalView } from './serverEval';
import * as practiceView from './practice/studyPracticeView';
import { playButtons as gbPlayButtons, overrideButton as gbOverrideButton } from './gamebook/gamebookButtons';
import { view as descView } from './chapterDescription';
import AnalyseCtrl from '../ctrl';
import { StudyCtrl, Tab, ToolTab } from './interfaces';
import { MaybeVNodes } from '../interfaces';


interface ToolButtonOpts {
  ctrl: StudyCtrl;
  tab: ToolTab;
  hint: string;
  icon: VNode;
  onClick?: () => void;
  count?: number | string;
}

function toolButton(opts: ToolButtonOpts): VNode {
  return h('span.' + opts.tab, {
    attrs: { title: opts.hint },
    class: { active: opts.tab === opts.ctrl.vm.toolTab() },
    hook: bind('mousedown', () => {
      if (opts.onClick) opts.onClick();
      opts.ctrl.vm.toolTab(opts.tab);
    }, opts.ctrl.redraw)
  }, [
    opts.count ? h('count.data-count', { attrs: { 'data-count': opts.count } }) : null,
    opts.icon
  ]);
}

function buttons(root: AnalyseCtrl): VNode {
  const ctrl: StudyCtrl = root.study!,
    canContribute = ctrl.members.canContribute(),
    showSticky = ctrl.data.features.sticky && (canContribute || (ctrl.vm.behind && ctrl.isUpdatedRecently()));
  return h('div.study__buttons', [
    h('div.left-buttons.tabs-horiz', [
      // distinct classes (sync, write) allow snabbdom to differentiate buttons
      showSticky ? h('a.mode.sync', {
        attrs: { title: 'All sync members remain on the same position' },
        class: { on: ctrl.vm.mode.sticky },
        hook: bind('click', ctrl.toggleSticky)
      }, [
        ctrl.vm.behind ? h('span.behind', '' + ctrl.vm.behind) : h('i.is'),
        'SYNC'
      ]) : null,
      ctrl.members.canContribute() ? h('a.mode.write', {
        attrs: { title: 'Write changes to the server' },
        class: { on: ctrl.vm.mode.write },
        hook: bind('click', ctrl.toggleWrite)
      }, [ h('i.is'), 'REC' ]) : null,
      toolButton({
        ctrl,
        tab: 'tags',
        hint: 'PGN tags',
        icon: iconTag('o'),
      }),
      toolButton({
        ctrl,
        tab: 'comments',
        hint: 'Comment this position',
        icon: iconTag('c'),
        onClick() {
          ctrl.commentForm.start(ctrl.vm.chapterId, root.path, root.node);
        },
        count: (root.node.comments || []).length
      }),
      canContribute ?  toolButton({
        ctrl,
        tab: 'glyphs',
        hint: 'Annotate with glyphs',
        icon: h('i.glyph-icon'),
        count: (root.node.glyphs || []).length
      }) : null,
      toolButton({
        ctrl,
        tab: 'serverEval',
        hint: root.trans.noarg('computerAnalysis'),
        icon: iconTag(''),
        count: root.data.analysis && '✓'
      }),
      toolButton({
        ctrl,
        tab: 'multiBoard',
        hint: 'Multiboard',
        icon: iconTag('')
      }),
      toolButton({
        ctrl,
        tab: 'share',
        hint: 'Share & export',
        icon: iconTag('$')
      }),
      h('span.help', {
        attrs: { title: 'Need help? Get the tour!', 'data-icon': '' },
        hook: bind('click', ctrl.startTour)
      })
    ]),
    h('div.right', [
      gbOverrideButton(ctrl)
    ])
  ]);
}

function metadata(ctrl: StudyCtrl): VNode {
  const d = ctrl.data;
  return h('div.study__metadata', [
    h('h2', [
      h('span.name', [
        d.name,
        ': ' + ctrl.currentChapter().name
      ]),
      h('span.liking.text', {
        class: { liked: d.liked },
        attrs: {
          'data-icon': d.liked ? '' : '',
          title: 'Like'
        },
        hook: bind('click', ctrl.toggleLike)
      }, '' + d.likes)
    ]),
    tagsView(ctrl)
  ]);
}

export function side(ctrl: StudyCtrl): VNode {

  const activeTab = ctrl.vm.tab();

  const makeTab = function(key: Tab, name: string) {
    return h('span.' + key, {
      class: { active: activeTab === key },
      hook: bind('mousedown', () => ctrl.vm.tab(key), ctrl.redraw)
    }, name);
  };

  const tabs = h('div.tabs-horiz', [
    makeTab('chapters', ctrl.trans.plural(ctrl.relay ? 'nbGames' : 'nbChapters', ctrl.chapters.size())),
    makeTab('members', ctrl.trans.plural('nbMembers', ctrl.members.size())),
    ctrl.members.isOwner() ? h('span.more', {
      hook: bind('click', () => ctrl.form.open(!ctrl.form.open()), ctrl.redraw)
    }, [ iconTag('[') ]) : null
  ]);

  return h('div.study__side', [
    tabs,
    (activeTab === 'members' ? memberView : chapterView)(ctrl)
  ]);
}

export function contextMenu(ctrl: StudyCtrl, path: Tree.Path, node: Tree.Node): VNode[] {
  return ctrl.vm.mode.write ? [
    h('a', {
      attrs: dataIcon('c'),
      hook: bind('click', () => {
        ctrl.vm.toolTab('comments');
        ctrl.commentForm.start(ctrl.currentChapter()!.id, path, node);
      })
    }, 'Comment this move'),
    h('a.glyph-icon', {
      hook: bind('click', () => {
        ctrl.vm.toolTab('glyphs');
        ctrl.userJump(path);
      })
    }, 'Annotate with glyphs')
  ] : [];
}

export function overboard(ctrl: StudyCtrl) {
  if (ctrl.chapters.newForm.vm.open) return chapterNewFormView(ctrl.chapters.newForm);
  if (ctrl.chapters.editForm.current()) return chapterEditFormView(ctrl.chapters.editForm);
  if (ctrl.members.inviteForm.open()) return inviteFormView(ctrl.members.inviteForm);
  if (ctrl.form.open()) return studyFormView(ctrl.form);
}

export function underboard(ctrl: AnalyseCtrl): MaybeVNodes {
  if (ctrl.embed) return [];
  if (ctrl.studyPractice) return practiceView.underboard(ctrl.study!);
  const study = ctrl.study!, toolTab = study.vm.toolTab();
  if (study.gamebookPlay()) return [
    gbPlayButtons(ctrl),
    descView(study),
    metadata(study)
  ];
  let panel;
  switch(toolTab) {
    case 'tags':
      panel = metadata(study);
      break;
    case 'comments':
      panel = study.vm.mode.write ?
        commentForm.view(ctrl) : (
          commentForm.viewDisabled(ctrl, study.members.canContribute() ?
            'Press REC to comment moves' :
            'Only the study members can comment on moves')
        );
      break;
    case 'glyphs':
      panel = ctrl.path ? (
        study.vm.mode.write ?
        glyphForm.view(study.glyphForm) :
        glyphForm.viewDisabled('Press REC to annotate moves')
      ) : glyphForm.viewDisabled('Select a move to annotate');
      break;
    case 'serverEval':
      panel = serverEvalView(study.serverEval);
      break;
    case 'share':
      panel = studyShareView(study.share);
      break;
    case 'multiBoard':
      panel = multiBoardView(study.multiBoard, study);
      break;
  }
  return [
    notifView(study.notif),
    descView(study),
    buttons(ctrl),
    panel
  ];
}
