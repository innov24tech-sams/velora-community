// Velora Chat - demo social app (localStorage backend)
const DB_KEY='velora_db_v1';
const SESSION_KEY='velora_session';

function uid(){return Math.random().toString(36).slice(2,10)+Date.now().toString(36);}
function timeAgo(ts){const d=Date.now()-ts;const m=Math.floor(d/60000);if(m<1)return 'now';if(m<60)return m+'m';const h=Math.floor(m/60);if(h<24)return h+'h';return Math.floor(h/24)+'d';}
function initials(name){return (name||'?').split(' ').map(s=>s[0]).join('').slice(0,2).toUpperCase();}

function loadDB(){
  let db=localStorage.getItem(DB_KEY);
  if(db) return JSON.parse(db);
  db=seed();
  saveDB(db);
  return db;
}
function saveDB(db){localStorage.setItem(DB_KEY,JSON.stringify(db));}

function seed(){
  const users=[
    {id:'u1',name:'Ava Stone',email:'ava@demo.com',phone:'+15550101',password:'1234',bio:'Designing beautiful things ✨',interests:['Design','Travel'],followers:['u2','u3'],following:['u2'],verified:true,private:false,premium:true},
    {id:'u2',name:'Leo Chen',email:'leo@demo.com',phone:'+15550102',password:'1234',bio:'Full-stack dev & coffee addict',interests:['Tech','Gaming'],followers:['u1'],following:['u1','u3'],verified:false,private:false},
    {id:'u3',name:'Mia Rivers',email:'mia@demo.com',phone:'+15550103',password:'1234',bio:'Photographer 📸 | world traveler',interests:['Photography','Nature'],followers:['u1'],following:['u1'],verified:true,private:false},
  ];
  const posts=[
    {id:'p1',userId:'u2',content:'Just shipped a huge feature at work! Feeling great 🚀',media:null,likes:['u1'],comments:[{id:'c1',userId:'u3',text:'Congrats!! 🎉',ts:Date.now()-3600000}],bookmarks:[],ts:Date.now()-7200000},
    {id:'p2',userId:'u3',content:'Golden hour at the mountains 🏔️',media:'https://picsum.photos/seed/mountain/600/400',likes:['u1','u2'],comments:[],bookmarks:['u1'],ts:Date.now()-18000000},
    {id:'p3',userId:'u1',content:'New portfolio design is live! Check it out, would love feedback 💜',media:'https://picsum.photos/seed/design/600/400',likes:[],comments:[],bookmarks:[],ts:Date.now()-86400000},
  ];
  const communities=[
    {id:'g1',name:'Design Lovers',desc:'A community for designers of all kinds',members:['u1','u2','u3'],private:false,owner:'u1',posts:3},
    {id:'g2',name:'Dev Talk',desc:'Discuss code, frameworks & careers',members:['u2'],private:false,owner:'u2',posts:5},
    {id:'g3',name:'Travel Diaries',desc:'Share your adventures',members:['u3','u1'],private:true,owner:'u3',posts:2},
  ];
  const stories=[
    {id:'s1',userId:'u2',ts:Date.now()-3600000},
    {id:'s2',userId:'u3',ts:Date.now()-5400000},
  ];
  const chats=[
    {id:'ch1',members:['u1','u2'],messages:[
      {id:'m1',from:'u2',text:'Hey! Saw your new design, looks amazing',ts:Date.now()-5000000},
      {id:'m2',from:'u1',text:'Thank you so much! 🙏',ts:Date.now()-4900000},
    ]},
    {id:'ch2',members:['u1','u3'],messages:[
      {id:'m3',from:'u3',text:'Are you coming to the meetup?',ts:Date.now()-9000000},
    ]},
  ];
  const notifications=[
    {id:'n1',userId:'u1',type:'like',fromId:'u2',postId:'p3',ts:Date.now()-3000000,read:false},
    {id:'n2',userId:'u1',type:'comment',fromId:'u3',postId:'p3',ts:Date.now()-2000000,read:false},
    {id:'n3',userId:'u1',type:'follow',fromId:'u3',ts:Date.now()-9000000,read:true},
  ];
  const invites=[];
  return {users,posts,communities,stories,chats,notifications,invites};
}

let DB=loadDB();
if(!DB.invites) DB.invites=[];
DB.users.forEach(u=>{if(u.phone===undefined)u.phone=null;});
saveDB(DB);
let session=JSON.parse(localStorage.getItem(SESSION_KEY)||'null');
let theme=localStorage.getItem('velora_theme')||'light';
document.documentElement.setAttribute('data-theme',theme);

let route='home';
let routeParam=null;
let authMode='login'; // login | signup (only relevant for email method now)
let authMethod='email'; // email | phone
let pendingOtp=null; // {phone, code, name?, isNew}

function currentUser(){return DB.users.find(u=>u.id===session?.userId);}
function findUser(id){return DB.users.find(u=>u.id===id);}
function findUserByPhone(phone){return DB.users.find(u=>u.phone===phone);}

function toast(msg){
  const t=document.createElement('div');t.className='toast';t.textContent=msg;
  document.body.appendChild(t);
  setTimeout(()=>t.remove(),2200);
}

function go(r,param){route=r;routeParam=param||null;render();window.scrollTo(0,0);}

function logout(){session=null;localStorage.removeItem(SESSION_KEY);go('home');}

function toggleTheme(){theme=theme==='light'?'dark':'light';document.documentElement.setAttribute('data-theme',theme);localStorage.setItem('velora_theme',theme);render();}

function normalizePhone(cc,num){return (cc+num).replace(/[^\d+]/g,'');}

// ---------- AUTH ----------
function renderAuth(){
  const app=document.getElementById('app');
  app.innerHTML=`<div class="auth-wrap"><div class="auth-box">
    <h1>Velora</h1>
    <p class="sub">${authMethod==='phone'?'Login or create an account with your phone number':(authMode==='login'?'Welcome back! Login to continue':'Create your account and join the community')}</p>
    <div class="authmethod-tabs">
      <div class="amtab ${authMethod==='email'?'active':''}" id="amEmail">✉️ Email</div>
      <div class="amtab ${authMethod==='phone'?'active':''}" id="amPhone">📱 Phone</div>
    </div>
    <div id="authErr" class="error"></div>
    <div id="authFormWrap"></div>
    <button class="btn secondary" style="width:100%;margin-top:10px" id="googleBtn">🔵 Continue with Google</button>
    <button class="btn outline" style="width:100%;margin-top:10px" id="guestBtn">Continue as Guest</button>
    ${authMode==='login'&&authMethod==='email'?'<p class="switch-auth" id="forgotLink" style="cursor:pointer">Forgot password?</p>':''}
    ${authMethod==='email'?`<p class="switch-auth">${authMode==='login'?"Don't have an account? <b id=\"toSignup\">Sign up</b>":"Already have an account? <b id=\"toLogin\">Login</b>"}</p>`:''}
  </div></div>`;
  renderAuthForm();
  document.getElementById('amEmail').onclick=()=>{authMethod='email';pendingOtp=null;renderAuth();};
  document.getElementById('amPhone').onclick=()=>{authMethod='phone';pendingOtp=null;renderAuth();};
  document.getElementById('googleBtn').onclick=()=>{
    const u=DB.users[0];
    session={userId:u.id};localStorage.setItem(SESSION_KEY,JSON.stringify(session));
    toast('Signed in with Google (demo)');
    go('home');
  };
  document.getElementById('guestBtn').onclick=()=>{
    session={userId:null,guest:true};localStorage.setItem(SESSION_KEY,JSON.stringify(session));
    go('home');
  };
  const fl=document.getElementById('forgotLink');
  if(fl) fl.onclick=()=>toast('Password reset link sent to your email (demo)');
  const ts=document.getElementById('toSignup'); if(ts) ts.onclick=()=>{authMode='signup';pendingOtp=null;renderAuth();};
  const tl=document.getElementById('toLogin'); if(tl) tl.onclick=()=>{authMode='login';pendingOtp=null;renderAuth();};
}

function renderAuthForm(){
  const wrap=document.getElementById('authFormWrap');
  if(authMethod==='email'){
    wrap.innerHTML=`<form id="authForm">
      ${authMode==='signup'?'<input type="text" id="afName" placeholder="Full name" required>':''}
      <input type="email" id="afEmail" placeholder="Email" required>
      <input type="password" id="afPass" placeholder="Password" required minlength="4">
      <button class="btn" style="width:100%" type="submit">${authMode==='login'?'Login':'Sign Up'}</button>
    </form>`;
    document.getElementById('authForm').onsubmit=(e)=>{
      e.preventDefault();
      const email=document.getElementById('afEmail').value.trim();
      const pass=document.getElementById('afPass').value;
      const errEl=document.getElementById('authErr');
      if(authMode==='signup'){
        const name=document.getElementById('afName').value.trim();
        if(!name||!email||!pass){errEl.textContent='Please fill all fields';return;}
        if(DB.users.find(u=>u.email===email)){errEl.textContent='Email already registered';return;}
        const u={id:uid(),name,email,phone:null,password:pass,bio:'',interests:[],followers:[],following:[],verified:false,private:false};
        DB.users.push(u);saveDB(DB);
        session={userId:u.id};localStorage.setItem(SESSION_KEY,JSON.stringify(session));
        toast('Welcome to Velora! Verification email sent 📧');
        go('home');
      } else {
        const u=DB.users.find(u=>u.email===email&&u.password===pass);
        if(!u){errEl.textContent='Invalid email or password';return;}
        session={userId:u.id};localStorage.setItem(SESSION_KEY,JSON.stringify(session));
        go('home');
      }
    };
  } else {
    // phone method - unified login + signup
    if(!pendingOtp){
      wrap.innerHTML=`<form id="phoneForm">
        <input type="text" id="pfName" placeholder="Full name (needed if creating a new account)">
        <div class="phone-row"><select id="pfCC"><option value="+1">🇺🇸 +1</option><option value="+44">🇬🇧 +44</option><option value="+91">🇮🇳 +91</option><option value="+61">🇦🇺 +61</option><option value="+971">🇦🇪 +971</option></select>
        <input type="tel" id="pfNum" placeholder="Phone number" required style="flex:1"></div>
        <button class="btn" style="width:100%" type="submit">Send OTP</button>
      </form>`;
      document.getElementById('phoneForm').onsubmit=(e)=>{
        e.preventDefault();
        const errEl=document.getElementById('authErr'); errEl.textContent='';
        const cc=document.getElementById('pfCC').value;
        const num=document.getElementById('pfNum').value.trim();
        const name=document.getElementById('pfName').value.trim();
        if(!num){errEl.textContent='Enter a valid phone number';return;}
        const phone=normalizePhone(cc,num);
        const existing=findUserByPhone(phone);
        if(!existing && !name){errEl.textContent='This number has no account yet — please enter your name to create one';return;}
        const code=String(Math.floor(1000+Math.random()*9000));
        pendingOtp={phone,code,name:name||null,isNew:!existing};
        toast(`Demo OTP sent: ${code}`);
        renderAuthForm();
      };
    } else {
      wrap.innerHTML=`<p style="font-size:13px;color:var(--muted);margin-bottom:10px">${pendingOtp.isNew?'Creating a new account. ':'Logging in. '}Enter the 4-digit code sent to ${pendingOtp.phone}</p>
      <form id="otpForm">
        <input type="text" id="otpInput" maxlength="4" placeholder="4-digit code" required>
        <button class="btn" style="width:100%" type="submit">Verify & ${pendingOtp.isNew?'Create Account':'Login'}</button>
      </form>
      <p class="switch-auth" id="resendOtp" style="cursor:pointer">Resend code</p>
      <p class="switch-auth" id="changeNum" style="cursor:pointer">Use a different number</p>`;
      document.getElementById('otpForm').onsubmit=(e)=>{
        e.preventDefault();
        const errEl=document.getElementById('authErr');
        const code=document.getElementById('otpInput').value.trim();
        if(code!==pendingOtp.code){errEl.textContent='Incorrect code, try again';return;}
        if(pendingOtp.isNew){
          if(findUserByPhone(pendingOtp.phone)){
            // race condition: account now exists, just log in
            const u=findUserByPhone(pendingOtp.phone);
            session={userId:u.id};localStorage.setItem(SESSION_KEY,JSON.stringify(session));
            pendingOtp=null;go('home');return;
          }
          const u={id:uid(),name:pendingOtp.name,email:null,phone:pendingOtp.phone,password:null,bio:'',interests:[],followers:[],following:[],verified:false,private:false};
          DB.users.push(u);saveDB(DB);
          session={userId:u.id};localStorage.setItem(SESSION_KEY,JSON.stringify(session));
          pendingOtp=null;
          toast('Account created! Welcome to Velora 🎉');
          go('home');
        } else {
          const u=findUserByPhone(pendingOtp.phone);
          if(!u){errEl.textContent='No account found with this phone number.';pendingOtp=null;renderAuthForm();return;}
          session={userId:u.id};localStorage.setItem(SESSION_KEY,JSON.stringify(session));
          pendingOtp=null;
          go('home');
        }
      };
      document.getElementById('resendOtp').onclick=()=>{const code=String(Math.floor(1000+Math.random()*9000));pendingOtp.code=code;toast(`New OTP: ${code}`);};
      document.getElementById('changeNum').onclick=()=>{pendingOtp=null;renderAuthForm();};
    }
  }
}

// ---------- NAV ----------
const NAVS=[
  {id:'home',label:'Home',icon:'🏠'},
  {id:'explore',label:'Explore',icon:'🔎'},
  {id:'communities',label:'Groups',icon:'👥'},
  {id:'messages',label:'Messages',icon:'💬'},
  {id:'notifications',label:'Alerts',icon:'🔔'},
  {id:'profile',label:'Profile',icon:'👤'},
];

function renderShell(innerHTML){
  const app=document.getElementById('app');
  const guest=session?.guest;
  app.innerHTML=`<div class="layout">
    <div class="sidebar">
      <div class="logo">Velora</div>
      ${NAVS.map(n=>`<a class="navitem ${route===n.id?'active':''}" data-nav="${n.id}"><span>${n.icon}</span>${n.label}</a>`).join('')}
      <a class="navitem" data-nav="admin" style="margin-top:auto">🛠️ Admin</a>
      <a class="navitem" id="themeBtnSide">${theme==='light'?'🌙 Dark mode':'☀️ Light mode'}</a>
      ${guest? `<a class="navitem" id="loginBtnSide">🔑 Login</a>` : `<a class="navitem" id="logoutBtnSide">🚪 Logout</a>`}
    </div>
    <div class="main">${innerHTML}</div>
    <div class="rightbar"><div class="card"><b>Trending</b><div style="margin-top:10px">${trendingHtml()}</div></div>
    <div class="card"><b>Suggested</b>${suggestedHtml()}</div></div>
  </div>
  <div class="bottomnav">
    ${NAVS.map(n=>`<a class="navitem ${route===n.id?'active':''}" data-nav="${n.id}"><span>${n.icon}</span>${n.label}</a>`).join('')}
  </div>`;
  app.querySelectorAll('[data-nav]').forEach(el=>el.onclick=()=>go(el.dataset.nav));
  const tb=document.getElementById('themeBtnSide'); if(tb) tb.onclick=toggleTheme;
  const lb=document.getElementById('logoutBtnSide'); if(lb) lb.onclick=logout;
  const lgb=document.getElementById('loginBtnSide'); if(lgb) lgb.onclick=()=>{session=null;localStorage.removeItem(SESSION_KEY);render();};
}

function trendingHtml(){
  return ['#DesignTrends','#WebDev','#TravelDiaries','#AIrevolution','#Photography'].map(t=>`<div style="padding:6px 0;font-size:13px;color:var(--accent);cursor:pointer">${t}</div>`).join('');
}
function suggestedHtml(){
  const me=currentUser();
  return DB.users.filter(u=>!me||u.id!==me.id).slice(0,3).map(u=>`<div style="display:flex;align-items:center;gap:8px;margin-top:10px"><div class="avatar sm">${initials(u.name)}</div><div style="flex:1;font-size:13px;font-weight:600">${u.name}</div></div>`).join('');
}

// ---------- INVITE BY PHONE ----------
function openInviteModal(context){
  // context: {type:'community', community} or {type:'chat'} or {type:'app'}
  openModal(`<h3>Invite via Phone Number</h3>
    <p style="font-size:13px;color:var(--muted);margin-bottom:10px">${context.type==='community'?`Invite someone to join "${context.community.name}"`:'Invite anyone to Velora by phone number'}</p>
    <div class="phone-row"><select id="invCC"><option value="+1">🇺🇸 +1</option><option value="+44">🇬🇧 +44</option><option value="+91">🇮🇳 +91</option><option value="+61">🇦🇺 +61</option><option value="+971">🇦🇪 +971</option></select>
    <input type="tel" id="invNum" placeholder="Phone number" style="flex:1"></div>
    <input type="text" id="invName" placeholder="Name (optional)">
    <button class="btn" style="width:100%" id="sendInviteBtn">Send Invite</button>
    <div id="inviteHistory" class="invite-list" style="margin-top:16px"></div>`);
  renderInviteHistory(context);
  document.getElementById('sendInviteBtn').onclick=()=>{
    const cc=document.getElementById('invCC').value;
    const num=document.getElementById('invNum').value.trim();
    const name=document.getElementById('invName').value.trim();
    if(!num){toast('Enter a phone number');return;}
    const phone=normalizePhone(cc,num);
    const existing=findUserByPhone(phone);
    const me=currentUser();
    DB.invites.unshift({id:uid(),phone,name:name||null,fromId:me.id,communityId:context.type==='community'?context.community.id:null,ts:Date.now()});
    if(existing && context.type==='community' && !context.community.members.includes(existing.id)){
      context.community.members.push(existing.id);
      toast(`${existing.name} is already on Velora — added to ${context.community.name}!`);
    } else {
      toast(`Invite text sent to ${phone} 📲 (demo)`);
    }
    saveDB(DB);
    document.getElementById('invNum').value='';document.getElementById('invName').value='';
    renderInviteHistory(context);
    render();
  };
}
function renderInviteHistory(context){
  const hist=document.getElementById('inviteHistory');
  const me=currentUser();
  const mine=DB.invites.filter(i=>i.fromId===me.id && (context.type!=='community' || i.communityId===context.community.id));
  if(mine.length===0){hist.innerHTML='';return;}
  hist.innerHTML=`<b style="font-size:13px">Recent Invites</b>`+mine.slice(0,5).map(i=>`<div class="chatlist-item"><div class="avatar sm">📱</div><div class="meta"><b>${i.name||i.phone}</b><div class="last">${i.phone} · ${timeAgo(i.ts)} ago</div></div></div>`).join('');
}

// ---------- HOME / FEED ----------
function renderHome(){
  const me=currentUser();
  const posts=[...DB.posts].sort((a,b)=>b.ts-a.ts);
  let html=`<div class="topbar"><h2>Home</h2><button class="iconbtn" id="searchTop">🔍</button></div>`;
  html+=`<div class="stories" id="storiesRow">`;
  html+=`<div class="story" id="addStory"><div class="ring" style="background:var(--border)"><div class="inner">+</div></div><span>Your story</span></div>`;
  DB.stories.forEach(s=>{const u=findUser(s.userId); if(!u)return; html+=`<div class="story" data-story="${s.id}"><div class="ring"><div class="inner">${initials(u.name)}</div></div><span>${u.name.split(' ')[0]}</span></div>`;});
  html+=`</div>`;
  if(me){
  html+=`<div class="card composer"><div style="display:flex;gap:10px"><div class="avatar sm">${initials(me.name)}</div><textarea id="newPostText" placeholder="What's on your mind, ${me.name.split(' ')[0]}?"></textarea></div>
  <div class="composer-actions"><div><span class="chip" id="attachMedia">📷 Photo</span><span class="chip" id="attachPoll">📊 Poll</span></div><button class="btn" id="postBtn">Post</button></div></div>`;
  } else {
    html+=`<div class="card" style="text-align:center">Browsing as guest — <b style="color:var(--accent);cursor:pointer" id="guestLoginPrompt">Login to post</b></div>`;
  }
  if(posts.length===0){html+=emptyState('📭','No posts yet','Follow people or create your first post!');}
  posts.forEach(p=>html+=postCard(p));
  renderShell(html);
  document.getElementById('searchTop').onclick=()=>go('explore');
  document.getElementById('addStory').onclick=()=>{ if(!me){toast('Login to add a story');return;} DB.stories.unshift({id:uid(),userId:me.id,ts:Date.now()}); saveDB(DB); toast('Story added!'); render();};
  document.querySelectorAll('[data-story]').forEach(el=>el.onclick=()=>{const s=DB.stories.find(x=>x.id===el.dataset.story);const u=findUser(s.userId);openModal(`<h3>${u.name}'s story</h3><div style="width:100%;height:300px;background:linear-gradient(135deg,var(--accent),var(--accent2));border-radius:14px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:40px">${initials(u.name)}</div><p style="margin-top:10px;color:var(--muted);font-size:12px">${timeAgo(s.ts)} ago</p>`);});
  const pb=document.getElementById('postBtn'); if(pb) pb.onclick=()=>{
    const txt=document.getElementById('newPostText').value.trim();
    if(!txt){toast('Write something first');return;}
    DB.posts.unshift({id:uid(),userId:me.id,content:txt,media:null,likes:[],comments:[],bookmarks:[],ts:Date.now()});
    saveDB(DB); toast('Posted!'); render();
  };
  const am=document.getElementById('attachMedia'); if(am) am.onclick=()=>{
    const txt=document.getElementById('newPostText').value.trim();
    DB.posts.unshift({id:uid(),userId:me.id,content:txt||'Shared a photo',media:`https://picsum.photos/seed/${uid()}/600/400`,likes:[],comments:[],bookmarks:[],ts:Date.now()});
    saveDB(DB);toast('Photo posted!');render();
  };
  const ap=document.getElementById('attachPoll'); if(ap) ap.onclick=()=>toast('Poll creation (demo) — coming in full version');
  const glp=document.getElementById('guestLoginPrompt'); if(glp) glp.onclick=()=>{session=null;localStorage.removeItem(SESSION_KEY);render();};
  bindPostCardEvents();
}

function emptyState(emoji,title,sub){
  return `<div class="empty"><span class="emoji">${emoji}</span><b>${title}</b><p style="margin-top:6px;font-size:13px">${sub}</p></div>`;
}

function postCard(p){
  const u=findUser(p.userId); if(!u) return '';
  const me=currentUser();
  const liked=me&&p.likes.includes(me.id);
  const marked=me&&p.bookmarks.includes(me.id);
  return `<div class="card" data-post="${p.id}">
    <div class="post-header"><div class="avatar sm">${initials(u.name)}</div>
      <div><div class="post-user">${u.name} ${u.verified?'✅':''}</div><div class="post-time">${timeAgo(p.ts)} ago</div></div></div>
    <div class="post-content">${escapeHtml(p.content)}</div>
    ${p.media?`<img class="post-media" src="${p.media}">`:''}
    <div class="post-actions">
      <button class="action like ${liked?'active':''}" data-act="like">${liked?'❤️':'🤍'} ${p.likes.length}</button>
      <button class="action" data-act="comment">💬 ${p.comments.length}</button>
      <button class="action" data-act="repost">🔁 Repost</button>
      <button class="action ${marked?'active':''}" data-act="bookmark">${marked?'🔖':'📑'}</button>
      <button class="action" data-act="share">↗️ Share</button>
    </div></div>`;
}

function escapeHtml(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML;}

function bindPostCardEvents(){
  document.querySelectorAll('[data-post]').forEach(card=>{
    const pid=card.dataset.post;
    const p=DB.posts.find(x=>x.id===pid);
    if(!p)return;
    const me=currentUser();
    card.querySelectorAll('[data-act]').forEach(btn=>{
      btn.onclick=()=>{
        if(!me){toast('Login to interact');return;}
        const act=btn.dataset.act;
        if(act==='like'){
          const i=p.likes.indexOf(me.id);
          if(i>-1)p.likes.splice(i,1);else p.likes.push(me.id);
          saveDB(DB);render();
        } else if(act==='bookmark'){
          const i=p.bookmarks.indexOf(me.id);
          if(i>-1)p.bookmarks.splice(i,1);else p.bookmarks.push(me.id);
          saveDB(DB);toast(i>-1?'Removed bookmark':'Saved!');render();
        } else if(act==='comment'){
          openModal(`<h3>Comments</h3><div style="max-height:300px;overflow-y:auto;margin-bottom:10px">${p.comments.length?p.comments.map(c=>{const cu=findUser(c.userId);return `<div style="display:flex;gap:8px;margin-bottom:10px"><div class="avatar sm">${initials(cu?.name||'?')}</div><div><b style="font-size:13px">${cu?.name}</b><p style="font-size:13px">${escapeHtml(c.text)}</p></div></div>`;}).join(''):'<p style="color:var(--muted);font-size:13px">No comments yet</p>'}</div>
          <div style="display:flex;gap:8px"><input type="text" id="cmtInput" placeholder="Add a comment..."><button class="btn" id="cmtBtn">Send</button></div>`);
          document.getElementById('cmtBtn').onclick=()=>{
            const v=document.getElementById('cmtInput').value.trim(); if(!v)return;
            p.comments.push({id:uid(),userId:me.id,text:v,ts:Date.now()});saveDB(DB);
            closeModal();render();
          };
        } else if(act==='repost'){
          DB.posts.unshift({id:uid(),userId:me.id,content:`🔁 Reposted: ${p.content}`,media:p.media,likes:[],comments:[],bookmarks:[],ts:Date.now()});
          saveDB(DB);toast('Reposted!');render();
        } else if(act==='share'){
          toast('Link copied to clipboard (demo)');
        }
      };
    });
  });
}

// ---------- EXPLORE ----------
function renderExplore(){
  let html=`<div class="topbar"><h2>Explore</h2></div>
  <div class="searchbar"><span>🔍</span><input type="text" id="exploreSearch" placeholder="Search users, hashtags, communities..."></div>
  <div class="tabs"><div class="tab active" data-tab="all">All</div><div class="tab" data-tab="users">Users</div><div class="tab" data-tab="tags">Hashtags</div><div class="tab" data-tab="groups">Communities</div></div>
  <div id="exploreResults"></div>`;
  renderShell(html);
  const input=document.getElementById('exploreSearch');
  function runSearch(){
    const q=input.value.trim().toLowerCase();
    const el=document.getElementById('exploreResults');
    if(!q){
      el.innerHTML=`<div class="grid2">${DB.posts.filter(p=>p.media).map(p=>`<img src="${p.media}" style="width:100%;border-radius:14px;height:150px;object-fit:cover">`).join('')}</div>`;
      return;
    }
    const users=DB.users.filter(u=>u.name.toLowerCase().includes(q));
    const groups=DB.communities.filter(g=>g.name.toLowerCase().includes(q));
    const posts=DB.posts.filter(p=>p.content.toLowerCase().includes(q));
    el.innerHTML=(users.length?`<b>Users</b>`+users.map(u=>userRow(u)).join(''):'')+
    (groups.length?`<b style="display:block;margin-top:14px">Communities</b>`+groups.map(g=>groupRow(g)).join(''):'')+
    (posts.length?`<b style="display:block;margin-top:14px">Posts</b>`+posts.map(postCard).join(''):'')+
    (!users.length&&!groups.length&&!posts.length?emptyState('🔍','No results','Try a different search term'):'');
    bindPostCardEvents();
    bindRowEvents();
  }
  input.oninput=runSearch; runSearch();
  document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));t.classList.add('active');});
}

function userRow(u){
  const me=currentUser();
  const following=me&&me.following.includes(u.id);
  return `<div class="chatlist-item" data-userrow="${u.id}"><div class="avatar sm">${initials(u.name)}</div><div class="meta"><b>${u.name}</b><div class="last">${u.bio||'No bio'}</div></div>${me&&me.id!==u.id?`<button class="btn ${following?'secondary':''}" data-follow="${u.id}" style="padding:6px 14px;font-size:12px">${following?'Following':'Follow'}</button>`:''}</div>`;
}
function groupRow(g){
  const me=currentUser();
  const joined=me&&g.members.includes(me.id);
  return `<div class="chatlist-item" data-grouprow="${g.id}"><div class="avatar sm">${initials(g.name)}</div><div class="meta"><b>${g.name} ${g.private?'🔒':''}</b><div class="last">${g.members.length} members</div></div>${me?`<button class="btn ${joined?'secondary':''}" data-join="${g.id}" style="padding:6px 14px;font-size:12px">${joined?'Joined':'Join'}</button>`:''}</div>`;
}
function bindRowEvents(){
  document.querySelectorAll('[data-follow]').forEach(b=>b.onclick=(e)=>{e.stopPropagation();const me=currentUser();const uid2=b.dataset.follow;const u=findUser(uid2);
    const i=me.following.indexOf(uid2);
    if(i>-1){me.following.splice(i,1);u.followers=u.followers.filter(x=>x!==me.id);}
    else{me.following.push(uid2);u.followers.push(me.id);DB.notifications.unshift({id:uid(),userId:uid2,type:'follow',fromId:me.id,ts:Date.now(),read:false});}
    saveDB(DB);render();
  });
  document.querySelectorAll('[data-join]').forEach(b=>b.onclick=(e)=>{e.stopPropagation();const me=currentUser();const gid=b.dataset.join;const g=DB.communities.find(x=>x.id===gid);
    const i=g.members.indexOf(me.id);
    if(i>-1)g.members.splice(i,1);else g.members.push(me.id);
    saveDB(DB);render();
  });
  document.querySelectorAll('[data-userrow]').forEach(r=>r.onclick=()=>go('userprofile',r.dataset.userrow));
  document.querySelectorAll('[data-grouprow]').forEach(r=>r.onclick=()=>go('communitydetail',r.dataset.grouprow));
}

// ---------- COMMUNITIES ----------
function renderCommunities(){
  const me=currentUser();
  let html=`<div class="topbar"><h2>Communities</h2><button class="btn" id="createGroupBtn">+ Create</button></div>`;
  if(DB.communities.length===0) html+=emptyState('👥','No communities','Create one to get started!');
  DB.communities.forEach(g=>html+=`<div class="card" data-grouprow="${g.id}"><div style="display:flex;justify-content:space-between;align-items:center"><div><h3>${g.name} ${g.private?'🔒':''}</h3><p style="color:var(--muted);font-size:13px;margin:4px 0">${g.desc}</p><span class="chip">${g.members.length} members</span><span class="chip">${g.posts} posts</span></div>${me?`<button class="btn ${g.members.includes(me.id)?'secondary':''}" data-join="${g.id}" style="padding:8px 16px;font-size:12px">${g.members.includes(me.id)?'Joined':'Join'}</button>`:''}</div></div>`);
  renderShell(html);
  bindRowEvents();
  document.querySelectorAll('[data-grouprow]').forEach(el=>{
    el.onclick=(e)=>{ if(e.target.closest('[data-join]')) return; go('communitydetail',el.dataset.grouprow); };
  });
  document.getElementById('createGroupBtn').onclick=()=>{
    if(!me){toast('Login to create a community');return;}
    openModal(`<h3>Create Community</h3><input type="text" id="gName" placeholder="Community name"><textarea id="gDesc" placeholder="Description"></textarea>
    <div class="toggle-row"><span>Private community</span><div class="sw" id="gPriv"><div class="dot"></div></div></div>
    <button class="btn" style="width:100%;margin-top:10px" id="gCreateBtn">Create</button>`);
    let priv=false;
    document.getElementById('gPriv').onclick=function(){priv=!priv;this.classList.toggle('on');};
    document.getElementById('gCreateBtn').onclick=()=>{
      const name=document.getElementById('gName').value.trim();
      const desc=document.getElementById('gDesc').value.trim();
      if(!name){toast('Enter a name');return;}
      DB.communities.unshift({id:uid(),name,desc,members:[me.id],private:priv,owner:me.id,posts:0});
      saveDB(DB);closeModal();toast('Community created!');render();
    };
  };
}

function renderCommunityDetail(){
  const g=DB.communities.find(x=>x.id===routeParam);
  if(!g){go('communities');return;}
  const me=currentUser();
  const joined=me&&g.members.includes(me.id);
  let html=`<div class="topbar"><button class="iconbtn" id="backBtn">←</button><h2>${g.name}</h2>${me?'<button class="iconbtn" id="inviteBtn">📲</button>':'<span></span>'}</div>
  <div class="card"><p>${g.desc}</p><div style="margin:10px 0"><span class="chip">${g.members.length} members</span>${g.private?'<span class="chip">🔒 Private</span>':'<span class="chip">🌐 Public</span>'}</div>
  ${me?`<button class="btn ${joined?'secondary':''}" id="joinToggle">${joined?'Leave':'Join'} Community</button> <button class="btn outline" id="inviteBtn2">📲 Invite via phone</button>`:''}</div>
  <div class="tabs"><div class="tab active">Discussion</div><div class="tab">Polls</div><div class="tab">Events</div><div class="tab">Members</div></div>
  <div class="card"><b>📊 Poll:</b> What topic next?<div style="margin-top:8px"><button class="btn secondary" style="width:100%;margin-bottom:6px;text-align:left">UI Trends 2024 (12)</button><button class="btn secondary" style="width:100%;text-align:left">Design Systems (8)</button></div></div>
  <div class="card"><b>📅 Upcoming Event:</b> Weekly community call - Friday 5PM</div>`;
  if(joined){
    html+=`<div class="card composer"><textarea id="gPostText" placeholder="Share something with the community..."></textarea><div class="composer-actions"><span></span><button class="btn" id="gPostBtn">Post</button></div></div>`;
  }
  renderShell(html);
  document.getElementById('backBtn').onclick=()=>go('communities');
  const jt=document.getElementById('joinToggle'); if(jt) jt.onclick=()=>{
    const i=g.members.indexOf(me.id);
    if(i>-1)g.members.splice(i,1);else g.members.push(me.id);
    saveDB(DB);render();
  };
  const gpb=document.getElementById('gPostBtn'); if(gpb) gpb.onclick=()=>{
    const t=document.getElementById('gPostText').value.trim(); if(!t)return;
    g.posts++; DB.posts.unshift({id:uid(),userId:me.id,content:`[${g.name}] ${t}`,media:null,likes:[],comments:[],bookmarks:[],ts:Date.now()});
    saveDB(DB);toast('Posted to community');render();
  };
  const inv=document.getElementById('inviteBtn'); if(inv) inv.onclick=()=>openInviteModal({type:'community',community:g});
  const inv2=document.getElementById('inviteBtn2'); if(inv2) inv2.onclick=()=>openInviteModal({type:'community',community:g});
}

// ---------- MESSAGES ----------
function renderMessages(){
  const me=currentUser();
  if(!me){renderShell(`<div class="topbar"><h2>Messages</h2></div>`+emptyState('🔒','Login required','Please login to use messaging'));return;}
  const chats=DB.chats.filter(c=>c.members.includes(me.id));
  let html=`<div class="topbar"><h2>Messages</h2><button class="iconbtn" id="inviteMsgBtn">📲</button></div>`;
  if(chats.length===0) html+=emptyState('💬','No conversations','Start chatting with people you follow, or invite someone via phone number.');
  chats.forEach(c=>{
    const otherId=c.members.find(m=>m!==me.id);
    const u=findUser(otherId);
    const last=c.messages[c.messages.length-1];
    html+=`<div class="chatlist-item" data-chat="${c.id}"><div class="avatar">${initials(u?.name||'?')}</div><div class="meta"><b>${u?.name}</b><div class="last">${last?escapeHtml(last.text):'No messages yet'}</div></div><div class="post-time">${last?timeAgo(last.ts):''}</div></div>`;
  });
  renderShell(html);
  document.querySelectorAll('[data-chat]').forEach(el=>el.onclick=()=>go('chat',el.dataset.chat));
  document.getElementById('inviteMsgBtn').onclick=()=>openInviteModal({type:'app'});
}

function renderChat(){
  const me=currentUser();
  const c=DB.chats.find(x=>x.id===routeParam);
  if(!c||!me){go('messages');return;}
  const otherId=c.members.find(m=>m!==me.id);
  const u=findUser(otherId);
  let html=`<div class="chat-window"><div class="topbar"><button class="iconbtn" id="backBtn">←</button><div style="display:flex;align-items:center;gap:8px"><div class="avatar sm">${initials(u.name)}</div><div><b>${u.name}</b><div style="font-size:11px;color:#2ecc71">● online</div></div></div><span></span></div>
  <div class="chat-messages" id="chatMessages">${c.messages.map(m=>`<div class="msg ${m.from===me.id?'me':'them'}">${escapeHtml(m.text)}</div>`).join('')}</div>
  <div class="typing" id="typingInd" style="display:none">${u.name} is typing...</div>
  <div class="chat-input"><input type="text" id="chatInput" placeholder="Type a message..."><button class="btn" id="sendBtn">Send</button></div></div>`;
  renderShell(html);
  document.getElementById('backBtn').onclick=()=>go('messages');
  const box=document.getElementById('chatMessages'); box.scrollTop=box.scrollHeight;
  function send(){
    const inp=document.getElementById('chatInput');
    const v=inp.value.trim(); if(!v)return;
    c.messages.push({id:uid(),from:me.id,text:v,ts:Date.now()});
    saveDB(DB);
    const box=document.getElementById('chatMessages');
    box.innerHTML+=`<div class="msg me">${escapeHtml(v)}</div>`;
    box.scrollTop=box.scrollHeight;
    inp.value='';
    const ind=document.getElementById('typingInd'); ind.style.display='block';
    setTimeout(()=>{
      ind.style.display='none';
      const replies=['That sounds great!','Totally agree 😄','Haha nice one','Let me think about it','Love that!','👍'];
      const r=replies[Math.floor(Math.random()*replies.length)];
      c.messages.push({id:uid(),from:otherId,text:r,ts:Date.now()});
      saveDB(DB);
      box.innerHTML+=`<div class="msg them">${escapeHtml(r)}</div>`;
      box.scrollTop=box.scrollHeight;
    },1400);
  }
  document.getElementById('sendBtn').onclick=send;
  document.getElementById('chatInput').onkeydown=(e)=>{if(e.key==='Enter')send();};
}

// ---------- NOTIFICATIONS ----------
function renderNotifications(){
  const me=currentUser();
  if(!me){renderShell(`<div class="topbar"><h2>Notifications</h2></div>`+emptyState('🔔','Login required','Login to see your notifications'));return;}
  const notifs=DB.notifications.filter(n=>n.userId===me.id).sort((a,b)=>b.ts-a.ts);
  let html=`<div class="topbar"><h2>Notifications</h2><button class="btn secondary" id="markAllBtn" style="font-size:12px;padding:6px 12px">Mark all read</button></div>`;
  if(notifs.length===0) html+=emptyState('🔔','No notifications yet','Likes, comments and follows show up here');
  notifs.forEach(n=>{
    const from=findUser(n.fromId);
    const icon=n.type==='like'?'❤️':n.type==='comment'?'💬':n.type==='follow'?'➕':'🔔';
    const text=n.type==='like'?'liked your post':n.type==='comment'?'commented on your post':n.type==='follow'?'started following you':'';
    html+=`<div class="notif-item ${n.read?'':'unread'}"><div class="avatar sm">${initials(from?.name||'?')}</div><div style="flex:1"><b>${from?.name}</b> ${text} <span style="color:var(--muted)">· ${timeAgo(n.ts)}</span></div><span>${icon}</span></div>`;
  });
  renderShell(html);
  const mb=document.getElementById('markAllBtn'); if(mb) mb.onclick=()=>{notifs.forEach(n=>n.read=true);saveDB(DB);render();};
}

// ---------- PROFILE ----------
function renderProfile(){
  const me=currentUser();
  if(!me){renderShell(`<div class="topbar"><h2>Profile</h2></div>`+emptyState('🔒','Guest mode','Login to view and edit your profile'));return;}
  renderProfileFor(me,true);
}
function renderUserProfile(){
  const u=findUser(routeParam);
  if(!u){go('explore');return;}
  renderProfileFor(u,false);
}
function renderProfileFor(u,isMe){
  const me=currentUser();
  const myPosts=DB.posts.filter(p=>p.userId===u.id);
  const bookmarked=isMe?DB.posts.filter(p=>p.bookmarks.includes(u.id)):[];
  const following=me&&!isMe&&me.following.includes(u.id);
  let html=`<div class="topbar">${isMe?'<h2>Profile</h2>':`<button class="iconbtn" id="backBtn">←</button>`}<span>${isMe?`<button class="iconbtn" id="settingsBtn">⚙️</button>`:''}</span></div>
  <div class="profile-header"><div class="avatar lg" style="margin:0 auto">${initials(u.name)}</div>
    <h2 style="margin-top:10px">${u.name} ${u.verified?'✅':''} ${u.premium?'⭐':''}</h2>
    <p style="color:var(--muted);font-size:13px">${u.bio||'No bio yet'}</p>
    ${u.phone?`<p style="color:var(--muted);font-size:12px">📱 ${u.phone}</p>`:''}
    <div>${(u.interests||[]).map(i=>`<span class="chip">${i}</span>`).join('')}</div>
    <div class="profile-stats"><div><b>${myPosts.length}</b><span>Posts</span></div><div><b>${u.followers.length}</b><span>Followers</span></div><div><b>${u.following.length}</b><span>Following</span></div></div>
    ${isMe?`<button class="btn outline" id="editProfileBtn">Edit Profile</button> <button class="btn secondary" id="inviteProfileBtn">📲 Invite friends</button>`:`<button class="btn ${following?'secondary':''}" data-follow="${u.id}">${following?'Following':'Follow'}</button> <button class="btn secondary" id="msgUserBtn">Message</button> <button class="btn secondary" id="blockBtn">🚫</button>`}
  </div>
  <div class="tabs"><div class="tab active" data-ptab="posts">Posts</div>${isMe?'<div class="tab" data-ptab="bookmarks">Bookmarks</div>':''}</div>
  <div id="profileContent"></div>`;
  renderShell(html);
  const content=document.getElementById('profileContent');
  function showPosts(){ content.innerHTML = myPosts.length? myPosts.map(postCard).join('') : emptyState('📭','No posts yet',''); bindPostCardEvents(); }
  function showBookmarks(){ content.innerHTML = bookmarked.length? bookmarked.map(postCard).join('') : emptyState('🔖','No bookmarks',''); bindPostCardEvents(); }
  showPosts();
  document.querySelectorAll('[data-ptab]').forEach(t=>t.onclick=()=>{document.querySelectorAll('[data-ptab]').forEach(x=>x.classList.remove('active'));t.classList.add('active'); t.dataset.ptab==='posts'?showPosts():showBookmarks();});
  const bb=document.getElementById('backBtn'); if(bb) bb.onclick=()=>go('explore');
  const sb=document.getElementById('settingsBtn'); if(sb) sb.onclick=()=>go('settings');
  const eb=document.getElementById('editProfileBtn'); if(eb) eb.onclick=()=>openEditProfile(u);
  const ipb=document.getElementById('inviteProfileBtn'); if(ipb) ipb.onclick=()=>openInviteModal({type:'app'});
  bindRowEvents();
  const mub=document.getElementById('msgUserBtn'); if(mub) mub.onclick=()=>{
    let c=DB.chats.find(c=>c.members.includes(me.id)&&c.members.includes(u.id));
    if(!c){c={id:uid(),members:[me.id,u.id],messages:[]};DB.chats.push(c);saveDB(DB);}
    go('chat',c.id);
  };
  const blk=document.getElementById('blockBtn'); if(blk) blk.onclick=()=>toast(u.name+' has been blocked (demo)');
}

function openEditProfile(u){
  openModal(`<h3>Edit Profile</h3><input type="text" id="epName" value="${u.name}" placeholder="Name"><textarea id="epBio" placeholder="Bio">${u.bio||''}</textarea><input type="text" id="epInterests" value="${(u.interests||[]).join(', ')}" placeholder="Interests (comma separated)"><input type="tel" id="epPhone" value="${u.phone||''}" placeholder="Phone number (optional)">
  <div class="toggle-row"><span>Private account</span><div class="sw ${u.private?'on':''}" id="epPriv"><div class="dot"></div></div></div>
  <button class="btn" style="width:100%;margin-top:10px" id="epSave">Save Changes</button>`);
  let priv=u.private;
  document.getElementById('epPriv').onclick=function(){priv=!priv;this.classList.toggle('on');};
  document.getElementById('epSave').onclick=()=>{
    u.name=document.getElementById('epName').value.trim()||u.name;
    u.bio=document.getElementById('epBio').value.trim();
    u.interests=document.getElementById('epInterests').value.split(',').map(s=>s.trim()).filter(Boolean);
    u.phone=document.getElementById('epPhone').value.trim()||null;
    u.private=priv;
    saveDB(DB);closeModal();toast('Profile updated');render();
  };
}

// ---------- SETTINGS ----------
function renderSettings(){
  const me=currentUser();
  let html=`<div class="topbar"><button class="iconbtn" id="backBtn">←</button><h2>Settings</h2><span></span></div>
  <div class="card"><div class="toggle-row"><span>Dark Mode</span><div class="sw ${theme==='dark'?'on':''}" id="darkSw"><div class="dot"></div></div></div>
  <div class="toggle-row"><span>Private Account</span><div class="sw ${me.private?'on':''}" id="privSw"><div class="dot"></div></div></div>
  <div class="toggle-row"><span>Push Notifications</span><div class="sw on" id="pushSw"><div class="dot"></div></div></div>
  <div class="toggle-row"><span>Read Receipts</span><div class="sw on" id="readSw"><div class="dot"></div></div></div></div>
  <div class="card"><b>Invite Friends</b><p style="font-size:13px;color:var(--muted);margin:8px 0">Invite anyone to Velora using their phone number.</p><button class="btn" id="inviteSettingsBtn">📲 Invite via phone</button></div>
  <div class="card"><b>Premium Membership</b><p style="font-size:13px;color:var(--muted);margin:8px 0">Unlock creator tools, no ads, and exclusive badge.</p><button class="btn" id="premiumBtn">${me.premium?'✓ Premium Active':'Upgrade - $4.99/mo'}</button></div>
  <div class="card"><b>Safety & Privacy</b><div class="toggle-row"><span>Blocked Accounts</span><span class="chip">0</span></div><div class="toggle-row"><span>Muted Accounts</span><span class="chip">0</span></div><button class="btn secondary" style="margin-top:10px;width:100%" id="reportBtn">Report a problem</button></div>
  <div class="card"><button class="btn" style="width:100%;background:var(--danger)" id="logoutBtn2">Logout</button></div>`;
  renderShell(html);
  document.getElementById('backBtn').onclick=()=>go('profile');
  document.getElementById('darkSw').onclick=toggleTheme;
  document.getElementById('privSw').onclick=function(){me.private=!me.private;saveDB(DB);this.classList.toggle('on');};
  document.getElementById('pushSw').onclick=function(){this.classList.toggle('on');};
  document.getElementById('readSw').onclick=function(){this.classList.toggle('on');};
  document.getElementById('inviteSettingsBtn').onclick=()=>openInviteModal({type:'app'});
  document.getElementById('premiumBtn').onclick=()=>{me.premium=true;saveDB(DB);toast('Welcome to Premium! ⭐');render();};
  document.getElementById('reportBtn').onclick=()=>toast('Report submitted. Our team will review it.');
  document.getElementById('logoutBtn2').onclick=logout;
}

// ---------- ADMIN ----------
function renderAdmin(){
  let html=`<div class="topbar"><h2>Admin Dashboard</h2></div>
  <div class="admin-stats">
    <div class="admin-stat"><b>${DB.users.length}</b><span>Total Users</span></div>
    <div class="admin-stat"><b>${DB.posts.length}</b><span>Total Posts</span></div>
    <div class="admin-stat"><b>${DB.communities.length}</b><span>Communities</span></div>
    <div class="admin-stat"><b>${DB.invites.length}</b><span>Phone Invites Sent</span></div>
  </div>
  <div class="card"><b>Recent Users</b>${DB.users.map(u=>`<div class="chatlist-item"><div class="avatar sm">${initials(u.name)}</div><div class="meta"><b>${u.name}</b><div class="last">${u.email||u.phone||''}</div></div><button class="btn secondary" style="padding:6px 12px;font-size:12px">Manage</button></div>`).join('')}</div>
  <div class="card"><b>Platform Settings</b><div class="toggle-row"><span>Allow new signups</span><div class="sw on"><div class="dot"></div></div></div><div class="toggle-row"><span>Auto content moderation</span><div class="sw on"><div class="dot"></div></div></div><div class="toggle-row"><span>Maintenance mode</span><div class="sw"><div class="dot"></div></div></div></div>`;
  renderShell(html);
  document.querySelectorAll('.sw').forEach(s=>s.onclick=function(){this.classList.toggle('on');});
}

// ---------- MODAL ----------
function openModal(html){
  let ov=document.getElementById('modalOverlay');
  if(!ov){ov=document.createElement('div');ov.id='modalOverlay';ov.className='modal-overlay';document.body.appendChild(ov);}
  ov.innerHTML=`<div class="modal"><button class="close-x" id="modalClose">&times;</button>${html}</div>`;
  ov.onclick=(e)=>{if(e.target===ov)closeModal();};
  document.getElementById('modalClose').onclick=closeModal;
}
function closeModal(){const ov=document.getElementById('modalOverlay'); if(ov)ov.remove();}

// ---------- ROUTER ----------
function render(){
  if(!session){renderAuth();return;}
  closeModal();
  switch(route){
    case 'home': renderHome(); break;
    case 'explore': renderExplore(); break;
    case 'communities': renderCommunities(); break;
    case 'communitydetail': renderCommunityDetail(); break;
    case 'messages': renderMessages(); break;
    case 'chat': renderChat(); break;
    case 'notifications': renderNotifications(); break;
    case 'profile': renderProfile(); break;
    case 'userprofile': renderUserProfile(); break;
    case 'settings': renderSettings(); break;
    case 'admin': renderAdmin(); break;
    default: renderHome();
  }
}

render();
