'use strict';
(() => {
  const panel=$('panel');
  const gameButton=$('friends');
  const text=(zh,en)=>state.settings.language==='zh'?zh:en;
  let user;
  let remembered;
  try { remembered=localStorage.getItem('2048-last-account')||undefined; } catch {}
  function remember(code) {
    remembered=code;
    try {
      if (code) localStorage.setItem('2048-last-account',code);
      else localStorage.removeItem('2048-last-account');
    } catch {}
  }
  let people=[];
  let blocked=[];
  let view;
  let pending=false;
  const syncKey='2048-account-progress';
  let progress={};
  try { progress=JSON.parse(localStorage.getItem(syncKey))||{}; } catch {}
  const persist=()=>{try {localStorage.setItem(syncKey,JSON.stringify(progress));} catch {}};
  const errors={
    credentials:['暱稱限 2～24 個字，可用文字、數字、底線與連字號。密碼限 8～128 字元。','Use 2–24 letters, numbers, underscores or dashes. Passwords need 8–128 characters.'],
    wrong:['帳號或密碼有誤。','Incorrect account or password.'],
    taken:['這個暱稱已有人使用。','This name is already taken.'],
    slow:['操作太頻繁，請稍後再試。','Too many requests. Try again shortly.'],
    peer:['找不到這個好友代碼。','Friend code not found.'],
    forbidden:['目前無法與這個帳號互動。','You cannot interact with this account right now.'],
    message:['請輸入 1～500 字的訊息。','Enter a message of 1–500 characters.'],
    login:['請先登入。','Please sign in first.']
  };
  async function api(route,data) {
    const response=await fetch('/api/'+route,data===undefined?{}:{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)
    });
    const result=await response.json();
    if (!response.ok) throw new Error(result.error);
    return result;
  }
  function label() {
    const unread=people.reduce((total,person)=>total+(isMuted(person.code)?0:person.unread||0),0);
    const badge=$('chat-unread');
    badge.hidden=!unread;
    badge.textContent=unread>99?'99+':unread;
    gameButton.setAttribute('aria-label',text('好友與聊天','Friends and chat')+(unread?' ('+unread+')':''));
    const accountEntry=$('account-entry');
    accountEntry.textContent=user?.name||text('登入','Sign in');
    accountEntry.title=accountEntry.textContent;
  }
  function isMuted(peer) {return !!progress.muted?.[user?.code]?.[peer];}
  function line(container,value) {
    const p=document.createElement('p');
    p.textContent=value;
    container.append(p);
    return p;
  }
  function makeView(title,back=closePanel) {
    const content=document.createElement('section');
    const heading=document.createElement('h2');
    heading.id='panel-title';
    heading.textContent=title;
    content.className='social-list';
    content.append(heading);
    const note=line(content,'');
    note.hidden=true;
    note.setAttribute('role','status');
    panel.replaceChildren(content,button(back===closePanel?t('close'):text('返回','Back'),back));
    panel.setAttribute('aria-labelledby',heading.id);
    if (!panel.open) panel.showModal();
    view=content;
    return {content,note};
  }
  async function act(screen,action) {
    try {await action();}
    catch(error) {
      if (view!==screen.content||!panel.open) return;
      screen.note.textContent=text(...(errors[error.message]||['目前無法連線或完成操作，請稍後再試。','Unable to complete this action. Try again when connected.']));
      screen.note.hidden=false;
    }
  }
  function input(label,type='text',maxLength=500) {
    const node=document.createElement('input');
    node.type=type;
    node.placeholder=label;
    node.setAttribute('aria-label',label);
    node.maxLength=maxLength;
    node.required=true;
    return node;
  }
  function form(screen,fields,caption,action) {
    const node=document.createElement('form');
    node.className='social-form';
    const submit=document.createElement('button');
    submit.textContent=caption;
    node.append(...fields,submit);
    node.onsubmit=event=>{
      event.preventDefault();
      submit.disabled=true;
      void act(screen,()=>action(...fields.map(field=>field.value))).finally(()=>{submit.disabled=false;});
    };
    screen.content.append(node);
    return node;
  }
  async function sync() {
    if (pending||!user) return;
    const code=user.code;
    const local=progress[code];
    if (!local) return;
    pending=true;
    try {
      const result=await api('sync',local);
      if (user?.code!==code) return;
      user=result.user;
      state.best=Math.max(state.best,user.best);
      state.largest=Math.max(state.largest,user.largest);
      save();
      render();
      if (progress[code]===local) {
        delete progress[code];
        persist();
      }
    } finally {pending=false;}
  }
  function record(best,largest) {
    const code=user?.code||remembered;
    if (!code) return;
    const old=progress[code];
    progress[code]={best:Math.max(old?.best||0,best),largest:Math.max(old?.largest||0,largest)};
    persist();
  }
  function signedIn(profile) {
    user=profile;
    const first=!progress.owner;
    switchProfile(user.code,first);
    remember(user.code);
    if (first) {
      progress.owner=user.code;
      record(state.best,state.largest);
    }
    state.best=Math.max(state.best,user.best);
    state.largest=Math.max(state.largest,user.largest);
    save();
    render();
  }
  async function refresh() {
    if (!user) return;
    const code=user.code;
    const result=await api('friends');
    if (user?.code!==code) return;
    people=result.people;
    blocked=result.blocked;
    label();
  }
  function showFriendCode(screen) {
    const code=user.friendCode||user.code;
    const label=line(screen.content,text('我的好友代碼','My friend code')+' '+code);
    label.className='friend-code';
    screen.content.append(button(text('複製代碼','Copy code'),()=>act(screen,async()=>{
      await navigator.clipboard.writeText(code);
      screen.note.textContent=text('已複製好友代碼。','Friend code copied.');
      screen.note.hidden=false;
    })));
  }
  function account(mode='login') {
    const screen=makeView(text('帳號','Account'));
    if (!user) {
      const name=input(text('暱稱','Name'),'text',24);
      const password=input(text('密碼','Password'),'password',128);
      name.autocomplete='username';
      password.autocomplete=mode==='register'?'new-password':'current-password';
      form(screen,[name,password],mode==='login'?text('登入','Sign in'):text('建立帳號','Create account'),async(name,password)=>{
        const result=await api(mode,{name,password});
        signedIn(result.user);
        account();
        void sync().catch(()=>{});
      });
      screen.content.append(button(mode==='login'?text('建立帳號','Create account'):text('回到登入','Back to sign in'),()=>account(mode==='login'?'register':'login')));
      return;
    }
    line(screen.content,user.name);
    showFriendCode(screen);
    line(screen.content,text('帳號最高分','Account best')+' '+user.best);
    screen.content.append(button(text('登出','Sign out'),()=>act(screen,async()=>{
      await sync();
      await api('logout',{});
      signedOut(); account();
    })),button(text('刪除帳號','Delete account'),deleteAccount));
  }
  function signedOut() {
    user=undefined;people=[];blocked=[];
    remember(undefined);
    switchProfile('');
    label();
  }
  function deleteAccount() {
    const screen=makeView(text('刪除帳號','Delete account'),()=>account());
    line(screen.content,text('輸入密碼確認刪除帳號、好友和聊天紀錄。','Enter your password to delete the account, friends and chat history.'));
    form(screen,[input(text('密碼','Password'),'password',128)],text('確認刪除','Confirm deletion'),async password=>{
      await api('delete',{password});
      delete progress[user.code];
      persist();
      const code=user.code;
      signedOut();
      try {localStorage.removeItem(key+'/'+code);} catch {}
      account();
    });
  }
  function friends(ranking=false,share=null) {
    if (!user) return account();
    const screen=makeView(share?text('分享給好友','Share with a friend'):ranking?text('好友排行','Friend rankings'):text('好友','Friends'));
    void act(screen,async()=>{
      await refresh();
      if (view!==screen.content||!panel.open) return;
      if (!ranking&&!share) {
        showFriendCode(screen);
        form(screen,[input(text('好友代碼，例如 ABC27','Friend code, e.g. ABC27'),'text',12)],text('送出邀請','Send invite'),async peer=>{
          await api('invite',{peer});
          friends();
        });
      }
      const visible=ranking||share?people.filter(p=>p.accepted):people;
      if (!visible.length) line(screen.content,text('目前沒有好友。','No friends yet.'));
      if (ranking) {
        for (const [index,person] of [user,...visible].sort((a,b)=>b.best-a.best).entries()) {
          line(screen.content,`${index+1}. ${person.name} · ${t('best')} ${person.best} · ${t('max')} ${person.largest||'–'}`);
        }
        return;
      }
      const friendList=document.createElement('div');
      friendList.className='social-list';
      const searchable=[];
      if (visible.some(person=>person.accepted)) {
        const search=input(text('搜尋好友暱稱','Search friend names'),'search',24);
        search.required=false;
        search.className='friend-search';
        const empty=line(screen.content,text('找不到符合的好友。','No matching friends.'));
        empty.hidden=true;
        search.oninput=()=>{
          const query=search.value.trim().toLocaleLowerCase();
          for (const [name,entry] of searchable) entry.hidden=!name.toLocaleLowerCase().includes(query);
          empty.hidden=!query||searchable.some(([,entry])=>!entry.hidden);
        };
        screen.content.insertBefore(search,empty);
      }
      screen.content.append(friendList);
      for (const person of visible) {
        const peer=person.code;
        if (person.accepted) {
          const entry=button(person.name+(person.unread?' ('+person.unread+')':''),()=>chat(person,share));
          searchable.push([person.name,entry]);
          friendList.append(entry);
          continue;
        }
        line(friendList,person.name+' · '+(person.sender===user.code?text('等待接受','Invitation sent'):text('邀請你成為好友','Wants to be friends')));
        const options=document.createElement('div');
        options.className='actions';
        if (person.sender!==user.code) options.append(button(text('接受','Accept'),()=>act(screen,async()=>{await api('accept',{peer});friends();})));
        options.append(button(person.sender===user.code?text('取消','Cancel'):text('拒絕','Decline'),()=>act(screen,async()=>{await api('remove',{peer});friends();})));
        friendList.append(options);
      }
      if (!share) for (const person of blocked) {
        screen.content.append(button(text('解除封鎖','Unblock')+' '+person.name,()=>act(screen,async()=>{
          await api('unblock',{peer:person.code});
          friends();
        })));
      }
    });
  }
  function chat(person,draft=null) {
    const peer=person.code;
    const screen=makeView(person.name,()=>friends());
    const list=document.createElement('div');
    list.className='conversation';
    list.setAttribute('role','log');
    screen.content.append(list);
    let latest;
    const load=()=>act(screen,async()=>{
      const {messages}=await api('messages',{peer});
      if (view!==screen.content||!panel.open) return;
      const last=messages.at(-1)?.id;
      if (last!==latest) {
        latest=last;
        list.replaceChildren();
        for (const message of messages) {
          const row=line(list,(message.sender===user.code?text('我','Me'):person.name)+' · '+message.body);
          row.className='message';
          if (message.sender!==user.code) row.append(button(text('檢舉','Report'),()=>act(screen,async()=>{
            await api('report',{peer,id:message.id});
            screen.note.hidden=false;
            screen.note.textContent=text('已送出檢舉。','Report sent.');
          })));
        }
        list.scrollTop=list.scrollHeight;
      }
      void refresh().catch(()=>{});
    });
    const editor=input(text('寫訊息','Write a message'));
    editor.value=draft||'';
    form(screen,[editor],text('傳送','Send'),async value=>{
      await api('send',{peer,text:value});
      editor.value='';
      await load();
    });
    const options=document.createElement('div');
    options.className='actions';
    for (const [route,name] of [['remove',text('移除好友','Remove friend')],['block',text('封鎖','Block')]]) {
      options.append(button(name,()=>act(screen,async()=>{
        if (!confirm(name+' '+person.name+'?')) return;
        await api(route,{peer});
        friends();
      })));
    }
    const mute=button('',()=>{
      const preferences=(progress.muted||={})[user.code]||={};
      preferences[peer]=!preferences[peer];
      persist();
      updateMute();
      label();
    });
    const updateMute=()=>{mute.textContent=isMuted(peer)?text('取消靜音','Unmute'):text('靜音','Mute');};
    updateMute();
    options.prepend(mute);
    screen.content.append(options);
    void load();
    const timer=setInterval(()=>{
      if (!panel.open||!screen.content.isConnected) return clearInterval(timer);
      if (document.visibilityState==='visible') void load();
    },8000);
  }
  async function update() {
    if (!user) {
      try { signedIn((await api('me')).user); }
      catch(error) { if (error.message==='login'&&remembered) signedOut(); throw error; }
    }
    await Promise.all([sync(),refresh()]);
  }
  window.social={
    label,account,friends,record,
    share:()=>friends(false,text(`我合出 2048 了！🎉 這局拿到 ${state.score} 分。`,`I reached 2048! 🎉 My score is ${state.score}.`))
  };
  if (remembered) switchProfile(remembered);
  $('account-entry').onclick=()=>account();
  gameButton.onclick=()=>friends();
  label();
  const poll=()=>{if (document.visibilityState==='visible') void update().catch(()=>{});};
  window.addEventListener('online',poll);
  setInterval(poll,12000);
  poll();
})();
