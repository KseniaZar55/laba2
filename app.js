(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const KEY_STORE = 'cineclub-omdb-key-v1';
  const GENRES = ['Action','Adventure','Animation','Biography','Comedy','Crime','Documentary','Drama','Family','Fantasy','Film-Noir','History','Horror','Music','Musical','Mystery','Romance','Sci-Fi','Sport','Thriller','War','Western'];
  // OMDb has no genre-discovery endpoint, so we search broad movie terms and filter the returned details by genre.
  const SEARCH_TERMS = ['love','night','life','star','world','dark','last','dream','time','man','girl','home','city','summer','future','secret','wild','blue','king','story','space','heart','dead','good','lost','road','moon','family','school','music','magic','ghost','war','friend','journey','beautiful'];
  const state = { genre:'', movies:[], saved:readStore('cineclub-saved'), passed:readStore('cineclub-passed'), view:'discover', loading:false, query:'' };
  function readStore(key){try{return JSON.parse(localStorage.getItem(key)||'[]')}catch{return[]}}
  function writeStore(){localStorage.setItem('cineclub-saved',JSON.stringify(state.saved));localStorage.setItem('cineclub-passed',JSON.stringify(state.passed));updateCounts()}
  function updateCounts(){$('#savedCount').textContent=state.saved.length;$('#passedCount').textContent=state.passed.length}
  function escapeHtml(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function poster(url){return url&&url!=='N/A'?url:'https://placehold.co/600x850/24251f/d5fa62?text=No+poster'}
  function year(value){return value&&value!=='N/A'?value:'Год неизвестен'}
  function apiKey(){return (localStorage.getItem(KEY_STORE)||'').trim()}
  function showSetup(show=true){$('#apiSetup').classList.toggle('visible',show);if(show)$('#apiKeyInput').value=apiKey()}
  function setStatus(text,kind=''){const el=$('#apiStatus');el.textContent=text;el.classList.remove('status-error','status-ok');if(kind)el.classList.add(kind);$('#statusDot').style.background=kind==='status-error'?'#ff796d':kind==='status-ok'?'#d5fa62':'#a4a69a'}
  function showError(message){$('#errorBox').textContent=message;$('#errorBox').classList.remove('hidden')}
  function clearError(){$('#errorBox').classList.add('hidden');$('#errorBox').textContent=''}
  function setLoading(on){state.loading=on;$('#loading').classList.toggle('hidden',!on);$('#refreshBtn').disabled=on;$('#searchBtn').disabled=on;$('#refreshBtn').style.opacity=on?'.6':'1'}
  async function omdb(params){const key=apiKey();if(!key)throw new Error('Сначала добавь OMDb API key в панели подключения выше.');const url=new URL('https://www.omdbapi.com/');url.searchParams.set('apikey',key);Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,v));let response;try{response=await fetch(url.toString())}catch{throw new Error('Не удалось подключиться к OMDb. Проверь интернет или попробуй позже.')}if(!response.ok)throw new Error(`OMDb вернул ошибку HTTP ${response.status}.`);const data=await response.json();if(data.Response==='False'){if(data.Error==='Invalid API key!')throw new Error('OMDb не принял ключ. Проверь, активирован ли он по письму.');if(data.Error==='Request limit reached!')throw new Error('Достигнут дневной лимит OMDb. Попробуй завтра.');return null}return data}
  function normalize(data){return {id:data.imdbID,title:data.Title||'Без названия',year:data.Year||'N/A',release_date:data.Year||'',poster_path:data.Poster||'N/A',vote_average:data.imdbRating&&data.imdbRating!=='N/A'?Number(data.imdbRating):0,genre:data.Genre||'',genreList:(data.Genre||'').split(',').map(x=>x.trim()).filter(Boolean),overview:data.Plot&&data.Plot!=='N/A'?data.Plot:'Описание для этого фильма пока не добавлено.',runtime:data.Runtime||'',director:data.Director||'',actors:data.Actors||'',type:data.Type||'movie',imdbID:data.imdbID}}
  function prettyGenres(movie){return (movie.genreList||[]).slice(0,2).join(' · ')||'Фильм'}
  function randomItem(arr){return arr[Math.floor(Math.random()*arr.length)]}
  async function searchTitles(term,page=1){const data=await omdb({s:term,type:'movie',page:String(page)});return data&&data.Search?data.Search:[]}
  async function details(id){const data=await omdb({i:id,plot:'short'});return data?normalize(data):null}
  async function getCandidates(){
    const terms=state.query?[state.query]:[...SEARCH_TERMS].sort(()=>Math.random()-.5).slice(0,4);
    const searchResults=[];
    for(const term of terms){
      const found=await searchTitles(term,1);
      for(const item of found){if(item.imdbID&&!searchResults.some(x=>x.imdbID===item.imdbID))searchResults.push(item)}
      if(state.query&&searchResults.length)break;
    }
    const exclude=new Set([...state.saved,...state.passed].map(m=>m.id));
    const candidates=searchResults.filter(x=>!exclude.has(x.imdbID)).sort(()=>Math.random()-.5);
    const results=[];
    // Fetch only a modest number of detail records to respect OMDb's free daily quota.
    for(const item of candidates.slice(0,18)){
      if(results.length>=3)break;
      const movie=await details(item.imdbID);
      if(!movie)continue;
      if(state.genre&&!movie.genreList.some(g=>g.toLowerCase()===state.genre.toLowerCase()))continue;
      results.push(movie);
    }
    return results;
  }
  async function loadPicks(){
    clearError();if(!apiKey()){showSetup(true);showError('Вставь OMDb API key в панели выше — ключ сохранится в этом браузере.');setStatus('нужен API-ключ');return}
    setLoading(true);$('#movieGrid').innerHTML='';
    try{const picks=await getCandidates();state.movies=picks;renderMovies();$('#resultNote').textContent=`ПОДБОРКА ИЗ ${picks.length} ФИЛЬМОВ`;if(!picks.length)showError(state.query?'Не нашлись фильмы по этому запросу. Попробуй другое название на английском.':'Не удалось найти три фильма в этом жанре. Выбери другой жанр или нажми «Другая подборка».');setStatus('OMDb подключён','status-ok');showSetup(false)}
    catch(e){showError(e.message);setStatus('ошибка подключения','status-error');if(/ключ|key/i.test(e.message))showSetup(true)}finally{setLoading(false)}
  }
  function movieCard(movie,index){const title=movie.title||'Без названия';const rating=movie.vote_average?movie.vote_average.toFixed(1):'—';return `<article class="movie-card" data-id="${escapeHtml(movie.id)}"><div class="poster-wrap"><img src="${escapeHtml(poster(movie.poster_path))}" alt="Постер фильма «${escapeHtml(title)}»" loading="lazy" onerror="this.src='https://placehold.co/600x850/24251f/d5fa62?text=No+poster'"><div class="poster-gradient"></div><div class="poster-topline"><span class="tag">ВАРИАНТ 0${index+1}</span><span class="rating"><span>★</span>${rating}</span></div><div class="poster-bottom"><span>${escapeHtml(year(movie.year))}</span><span>IMDb ↗</span></div></div><div class="movie-info"><h2 class="movie-title" title="${escapeHtml(title)}">${escapeHtml(title)}</h2><div class="movie-meta"><span>${escapeHtml(prettyGenres(movie))}</span><span class="meta-sep">/</span><span>${escapeHtml(movie.runtime||'ФИЛЬМ')}</span></div><p class="movie-overview">${escapeHtml(movie.overview)}</p><div class="card-actions"><button class="action-btn yes" data-action="yes" data-id="${escapeHtml(movie.id)}"><span class="action-icon">♡</span> ДА, В СПИСОК</button><button class="action-btn no" data-action="no" data-id="${escapeHtml(movie.id)}"><span class="action-icon">×</span> НЕТ, ДАЛЬШЕ</button></div><a class="detail-link" href="https://www.imdb.com/title/${encodeURIComponent(movie.id)}/" target="_blank" rel="noopener">ПОДРОБНЕЕ О ФИЛЬМЕ ↗</a></div></article>`}
  function renderMovies(){$('#movieGrid').innerHTML=state.movies.map(movieCard).join('')}
  function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),2200)}
  async function actOnMovie(id,action){const movie=state.movies.find(m=>m.id===id);if(!movie)return;if(action==='yes'){if(!state.saved.some(m=>m.id===id))state.saved.unshift(movie);state.passed=state.passed.filter(m=>m.id!==id);toast('Добавили в избранное ♡')}else{if(!state.passed.some(m=>m.id===id))state.passed.unshift(movie);state.saved=state.saved.filter(m=>m.id!==id);toast('Окей, ищем дальше ↗')}writeStore();state.movies=state.movies.filter(m=>m.id!==id);renderMovies();$('#resultNote').textContent=`ОСТАЛОСЬ ${state.movies.length} ФИЛЬМА(ОВ)`;if(!state.movies.length)await loadPicks()}
  function switchView(view){state.view=view;$('#discoverView').classList.toggle('hidden',view!=='discover');$('#collectionView').classList.toggle('hidden',view==='discover');document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===view));$('#breadcrumbCurrent').textContent=view==='discover'?'ПОДБОРКА':view==='saved'?'ИЗБРАННОЕ':'ПРОПУЩЕНО';if(view!=='discover')renderCollection(view);window.scrollTo({top:0,behavior:'smooth'})}
  function renderCollection(view){const items=view==='saved'?state.saved:state.passed;$('#collectionTitle').innerHTML=view==='saved'?'Избранное<span class="lime-dot">.</span>':'Пропущено<span class="lime-dot">.</span>';$('#collectionCopy').textContent=view==='saved'?'Фильмы, которые хочется посмотреть.':'Фильмы, которые ты пока решила пропустить.';$('#emptyCollection').classList.toggle('hidden',items.length>0);$('#collectionGrid').classList.toggle('hidden',items.length===0);$('#collectionGrid').innerHTML=items.map(m=>`<article class="collection-card"><img src="${escapeHtml(poster(m.poster_path))}" alt="Постер ${escapeHtml(m.title)}" loading="lazy"><div class="collection-card-info"><h3>${escapeHtml(m.title)}</h3><p>${escapeHtml(year(m.year))} · ★ ${m.vote_average?m.vote_average.toFixed(1):'—'}</p><div class="collection-actions"><a href="https://www.imdb.com/title/${encodeURIComponent(m.id)}/" target="_blank" rel="noopener">О фильме ↗</a><button data-collection-action="remove" data-id="${escapeHtml(m.id)}" data-view="${view}">Убрать ×</button></div></div></article>`).join('')}
  function fillGenres(){GENRES.forEach(genre=>{const opt=document.createElement('option');opt.value=genre;opt.textContent=genre;$('#genreSelect').appendChild(opt)})}
  $('#movieGrid').addEventListener('click',e=>{const btn=e.target.closest('button[data-action]');if(btn)actOnMovie(btn.dataset.id,btn.dataset.action)});
  $('#collectionGrid').addEventListener('click',e=>{const btn=e.target.closest('button[data-collection-action]');if(!btn)return;const key=btn.dataset.view==='saved'?'saved':'passed';state[key]=state[key].filter(m=>m.id!==btn.dataset.id);writeStore();renderCollection(state.view);toast('Убрано из списка')});
  document.querySelectorAll('.nav-item').forEach(btn=>btn.addEventListener('click',()=>switchView(btn.dataset.view)));
  $('#refreshBtn').addEventListener('click',()=>{state.query='';$('#searchInput').value='';loadPicks()});
  $('#genreSelect').addEventListener('change',e=>{state.genre=e.target.value;state.query='';$('#searchInput').value='';loadPicks()});
  $('#searchBtn').addEventListener('click',()=>{state.query=$('#searchInput').value.trim();if(!state.query){showError('Введи название или ключевое слово для поиска.');return}loadPicks()});
  $('#searchInput').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('#searchBtn').click()}});
  $('#keyForm').addEventListener('submit',async e=>{e.preventDefault();const value=$('#apiKeyInput').value.trim();if(!value)return;localStorage.setItem(KEY_STORE,value);state.query='';setStatus('проверяем ключ');await loadPicks()});
  $('#settingsBtn').addEventListener('click',()=>{showSetup(!$('#apiSetup').classList.contains('visible'));if($('#apiSetup').classList.contains('visible'))$('#apiKeyInput').focus()});
  $('#backToDiscover').addEventListener('click',()=>switchView('discover'));
  fillGenres();updateCounts();if(apiKey()){showSetup(false);loadPicks()}else{showSetup(true);setStatus('нужен API-ключ');$('#loading').classList.add('hidden')}
})();
