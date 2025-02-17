import { h } from 'snabbdom'
import { VNode } from 'snabbdom/vnode'
import { titleNameToId, bind, dataIcon, iconTag, onInsert, scrollTo } from '../util';
import { prop, Prop } from 'common';
import { ctrl as inviteFormCtrl } from './inviteForm';
import { StudyCtrl, StudyMember, StudyMemberMap, Tab } from './interfaces';
import { NotifCtrl } from './notif';

interface Opts {
  initDict: StudyMemberMap;
  myId: string | null;
  ownerId: string;
  send: SocketSend;
  tab: Prop<Tab>;
  startTour(): void;
  notif: NotifCtrl;
  onBecomingContributor(): void;
  redraw(): void
}

function memberActivity(onIdle) {
  let timeout;
  let schedule = function() {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(onIdle, 100);
  };
  schedule();
  return schedule;
}

export function ctrl(opts: Opts) {

  const dict = prop<StudyMemberMap>(opts.initDict);
  const confing = prop<string | undefined>(undefined);
  let active: { [id: string]: () => void } = {};
  let online: { [id: string]: boolean } = {};
  let spectatorIds: string[] = [];
  const max = 30;

  function owner() {
    return dict()[opts.ownerId];
  };

  function isOwner() {
    return opts.myId === opts.ownerId;
  };

  function myMember() {
    return opts.myId ? dict()[opts.myId] : null;
  };

  function canContribute() {
    var m = myMember();
    return m && m.role === 'w';
  };

  const inviteForm = inviteFormCtrl(opts.send, dict, () => opts.tab('members'), opts.redraw);

  function setActive(id) {
    if (opts.tab() !== 'members') return;
    if (active[id]) active[id]();
    else active[id] = memberActivity(function() {
      delete(active[id]);
      opts.redraw();
    });
    opts.redraw();
  };

  function updateOnline() {
    online = {};
    const members: StudyMemberMap = dict();
    spectatorIds.forEach(function(id) {
      if (members[id]) online[id] = true;
    });
    if (opts.tab() === 'members') opts.redraw();
  }

  return {
    dict,
    confing,
    myId: opts.myId,
    inviteForm,
    update(members: StudyMemberMap) {
      if (isOwner()) confing(Object.keys(members).find(function(uid) {
        return !dict()[uid];
      }));
      const wasViewer = myMember() && !canContribute();
      const wasContrib = myMember() && canContribute();
      dict(members);
      if (wasViewer && canContribute()) {
        if (window.lichess.once('study-tour')) opts.startTour();
        opts.onBecomingContributor();
        opts.notif.set({
          text: 'You are now a contributor',
          duration: 3000
        });
      } else if (wasContrib && !canContribute()) opts.notif.set({
        text: 'You are now a spectator',
        duration: 3000
      });
      updateOnline();
    },
    setActive,
    isActive(id) {
      return !!active[id];
    },
    owner,
    myMember,
    isOwner,
    canContribute,
    max,
    setRole(id, role) {
      setActive(id);
      opts.send("setRole", {
        userId: id,
        role
      });
      confing(undefined);
    },
    kick(id) {
      opts.send("kick", id);
      confing(undefined);
    },
    leave() {
      opts.send("leave");
    },
    ordered() {
      const d = dict();
      return Object.keys(d).map(id => d[id]).sort(function(a, b) {
        if (a.role === 'r' && b.role === 'w') return 1;
        if (a.role === 'w' && b.role === 'r') return -1;
        return a.addedAt > b.addedAt ? 1 : -1;
      });
    },
    size() {
      return Object.keys(dict()).length;
    },
    setSpectators(usernames: string[]) {
      this.inviteForm.setSpectators(usernames);
      spectatorIds = usernames.map(titleNameToId);
      updateOnline();
    },
    isOnline(userId: string) {
      return online[userId];
    },
    hasOnlineContributor() {
      const members = dict();
      for (let i in members) if (online[i] && members[i].role === 'w') return true;
      return false;
    }
  };
}

export function view(ctrl: StudyCtrl): VNode {

  const isOwner = ctrl.members.isOwner();

  function username(member: StudyMember) {
    var u = member.user;
    return h('span.user-link.ulpt', {
      attrs: { 'data-href': '/@/' + u.name }
    }, (u.title ? u.title + ' ' : '') + u.name);
  };

  function statusIcon(member: StudyMember) {
    const contrib = member.role === 'w';
    return h('span.status', {
      class: {
        contrib,
        active: ctrl.members.isActive(member.user.id),
        online: ctrl.members.isOnline(member.user.id)
      },
      attrs: { title: contrib ? 'Contributor' : 'Viewer' },
    }, [
      iconTag(contrib ? 'r' : 'v')
    ]);
  };

  function configButton(ctrl: StudyCtrl, member: StudyMember) {
    if (isOwner && member.user.id !== ctrl.members.myId)
      return h('act', {
        key: 'cfg-' + member.user.id,
        attrs: dataIcon('%'),
        hook: bind('click', _ => {
          ctrl.members.confing(ctrl.members.confing() === member.user.id ? null : member.user.id);
        }, ctrl.redraw)
      });
    if (!isOwner && member.user.id === ctrl.members.myId)
      return h('act.leave', {
        key: 'leave',
        attrs: {
          'data-icon': 'F',
          title: 'Leave the study'
        },
        hook: bind('click', ctrl.members.leave, ctrl.redraw)
      });
  };

  function memberConfig(member: StudyMember): VNode {
    const roleId = 'member-role';
    return h('m-config', {
      key: member.user.id + '-config',
      hook: onInsert(el => scrollTo($(el).parent('.members')[0] as HTMLElement, el))
    }, [
      h('div.role', [
        h('div.switch', [
          h('input.cmn-toggle', {
            attrs: {
              id: roleId,
              type: 'checkbox',
              checked: member.role === 'w'
            },
            hook: bind('change', e => {
              ctrl.members.setRole(member.user.id, (e.target as HTMLInputElement).checked ? 'w' : 'r');
            }, ctrl.redraw)
          }),
          h('label', { attrs: { 'for': roleId } })
        ]),
        h('label', { attrs: { 'for': roleId } }, 'Contributor')
      ]),
      h('div.kick', h('a.button.button-red.button-empty.text', {
        attrs: dataIcon('L'),
        hook: bind('click', _ => ctrl.members.kick(member.user.id), ctrl.redraw)
      }, 'Kick'))
    ]);
  };

  var ordered = ctrl.members.ordered();

  return h('div.study__members', {
    hook: {
      insert: _ => {
        window.lichess.pubsub.emit('content_loaded')();
        window.lichess.pubsub.emit('chat.resize')();
      }
    }
  }, [
    ...ordered.map(function(member) {
      const confing = ctrl.members.confing() === member.user.id;
      return [
        h('div', {
          key: member.user.id,
          class: { editing: !!confing }
        }, [
          h('div.left', [
            statusIcon(member),
            username(member)
          ]),
          configButton(ctrl, member)
        ]),
        confing ? memberConfig(member) : null
      ];
    }).reduce((a, b) => a.concat(b), []),
    (isOwner && ordered.length < ctrl.members.max) ? h('div.add', {
      key: 'add',
      hook: bind('click', ctrl.members.inviteForm.toggle, ctrl.redraw)
    }, [
      h('div.left', [
        h('span.status', iconTag('O')),
        h('div.user-link', ctrl.trans.noarg('addMembers'))
      ])
    ]) : null
  ]);
}
