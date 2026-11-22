/* Premium motion layer for Pravas Palace: no libraries, progressive enhancement */
(function(){
'use strict';
var RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
var FINE=matchMedia('(hover:hover) and (pointer:fine)').matches;
var $=function(s,r){return (r||document).querySelector(s)},$$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};
var seen=false;try{seen=sessionStorage.getItem('pp-intro')==='1'}catch(e){}

/* 1. curtain preloader (first visit per session) */
if(!RM&&!seen){
  var c=document.createElement('div');c.id='curtain';c.setAttribute('aria-hidden','true');
  c.innerHTML='<div class="pane l"></div><div class="pane r"></div><div class="mark"><svg viewBox="0 0 100 120"><path class="d1" pathLength="1" d="M8 116V50A42 42 0 0 1 92 50V116"/><path class="d2" pathLength="1" d="M20 116V52A30 30 0 0 1 80 52V116"/><circle class="d3" pathLength="1" cx="50" cy="14" r="5"/><path class="d4" pathLength="1" d="M50 40v22M38 51h24M50 80c-9-9-9-18 0-26 9 8 9 17 0 26z"/></svg><b>Pravas Palace</b><small>Tindivanam</small></div>';
  document.body.appendChild(c);
  document.documentElement.style.overflow='hidden';
  setTimeout(function(){c.classList.add('open')},2000);
  setTimeout(function(){c.classList.add('gone');document.documentElement.style.overflow=''},3700);
  try{sessionStorage.setItem('pp-intro','1')}catch(e){}
}else document.body.classList.add('nocurtain');

/* 2. scroll progress + parallax */
var bar=document.createElement('div');bar.id='prog';document.body.appendChild(bar);
var hero=$('.hero'),hc=$('.hcopy'),ticking=false;
function onScroll(){
  if(ticking)return;ticking=true;
  requestAnimationFrame(function(){
    var h=document.documentElement,max=h.scrollHeight-innerHeight;
    bar.style.transform='scaleX('+(max>0?scrollY/max:0)+')';
    if(!RM){
      if(hc&&hero&&scrollY<innerHeight&&!hero.classList.contains('touring'))hc.style.translate='0 '+(scrollY*.22)+'px';
      $$('.shot .mask img').forEach(function(im){
        var r=im.parentNode.getBoundingClientRect();if(r.bottom<0||r.top>innerHeight)return;
        var p=(r.top+r.height/2-innerHeight/2)/innerHeight;im.style.translate='0 '+(p*-34)+'px';
      });
    }
    ticking=false;
  });
}
addEventListener('scroll',onScroll,{passive:true});

/* 3. split the hero title into letters */
var h1=$('.hcopy h1');
if(h1&&!RM){
  var base=seen?0:2000,n=0;
  (function split(node){
    Array.prototype.slice.call(node.childNodes).forEach(function(ch){
      if(ch.nodeType===3){
        var f=document.createDocumentFragment();
        ch.textContent.split('').forEach(function(t){
          if(t===' '){f.appendChild(document.createTextNode(' '));return}
          var s=document.createElement('span');s.className='ch';s.setAttribute('aria-hidden','true');s.textContent=t;
          s.style.animationDelay=(base+n++*55)+'ms';f.appendChild(s);
        });
        ch.parentNode.replaceChild(f,ch);
      }else if(ch.nodeType===1)split(ch);
    });
  })(h1);
  h1.setAttribute('aria-label',h1.textContent.replace(/\s+/g,' ').trim());
  var after=base/1000+n*.055+.2;
  [['.hcopy .ta',0],['.hcopy p',.3],['.hcopy .hacts',.5],['.glass',.7]].forEach(function(a){var e=$(a[0]);if(e)e.style.animationDelay=(after+a[1])+'s'});
}

/* 4. drifting petals + gold dust over the hero */
if(hero&&!RM){
  var cv=document.createElement('canvas');cv.id='petals';cv.setAttribute('aria-hidden','true');
  hero.insertBefore(cv,$('.scrim',hero));
  var cue=document.createElement('i');cue.className='scroll-cue';hero.appendChild(cue);
  var x=cv.getContext('2d'),W=0,H=0,dpr=Math.min(devicePixelRatio||1,2),P=[],vis=true;
  var cols=['#E9A23B','#D9822B','#B04A63','#F2C879','#C58A5B'];
  var fit=function(){W=cv.clientWidth;H=cv.clientHeight;cv.width=W*dpr;cv.height=H*dpr;x.setTransform(dpr,0,0,dpr,0,0)};
  var mk=function(init){return{x:Math.random()*W,y:init?Math.random()*H:-20,r:3+Math.random()*7,s:.25+Math.random()*.7,sw:Math.random()*6.28,sv:.004+Math.random()*.012,rot:Math.random()*6.28,rv:(Math.random()-.5)*.03,c:cols[Math.random()*cols.length|0],dust:Math.random()<.45,a:.35+Math.random()*.5}};
  fit();addEventListener('resize',fit);
  var N=innerWidth<700?22:46;for(var i=0;i<N;i++)P.push(mk(true));
  new IntersectionObserver(function(e){vis=e[0].isIntersecting}).observe(hero);
  (function tick(){
    requestAnimationFrame(tick);if(!vis||document.hidden)return;
    x.clearRect(0,0,W,H);
    P.forEach(function(p,i){
      p.y+=p.s;p.sw+=p.sv;p.x+=Math.sin(p.sw)*.6;p.rot+=p.rv;
      if(p.y>H+20)P[i]=mk(false);
      x.globalAlpha=p.a;x.fillStyle=p.c;
      if(p.dust){x.beginPath();x.arc(p.x,p.y,p.r*.22,0,6.28);x.fill();return}
      x.save();x.translate(p.x,p.y);x.rotate(p.rot);x.scale(1,.55+.45*Math.abs(Math.sin(p.sw)));
      x.beginPath();x.ellipse(0,0,p.r,p.r*.55,0,0,6.28);x.fill();x.restore();
    });
    x.globalAlpha=1;
  })();
}

/* 5. ticker becomes a seamless marquee */
var tk=$('.tick');
if(tk&&!RM){var items=tk.innerHTML,t=document.createElement('div');t.className='track';t.innerHTML=items+items;tk.innerHTML='';tk.appendChild(t)}

/* 6. section numerals and gold ornaments */
var ornSvg='<svg viewBox="-20 -20 40 40" fill="none" stroke="currentColor" stroke-width="1"><circle r="3"/><circle r="17"/><g id="o"><path d="M0-17C5-11 5-6 0-3C-5-6-5-11 0-17Z"/></g><use href="#o" transform="rotate(45)"/><use href="#o" transform="rotate(90)"/><use href="#o" transform="rotate(135)"/><use href="#o" transform="rotate(180)"/><use href="#o" transform="rotate(225)"/><use href="#o" transform="rotate(270)"/><use href="#o" transform="rotate(315)"/></svg>';
$$('section.band').forEach(function(s,i){
  var ta=$('.ta',s);
  if(ta&&s.id&&s.id!=='faq'){
    var nm=document.createElement('span');nm.className='num';
    nm.textContent=('0'+i).slice(-2)+' — '+(s.id==='book'?'Reserve':s.id.charAt(0).toUpperCase()+s.id.slice(1));
    ta.parentNode.insertBefore(nm,ta);
  }
});
var spaces=$('#spaces');
if(spaces){var o=document.createElement('div');o.className='orn';o.setAttribute('aria-hidden','true');o.innerHTML=ornSvg;spaces.parentNode.insertBefore(o,spaces)}
var faq=$('#faq .reveal');
if(faq){var o2=document.createElement('div');o2.className='orn';o2.setAttribute('aria-hidden','true');o2.innerHTML=ornSvg;faq.insertBefore(o2,faq.firstChild)}

/* 7. image masks for the spaces (built by the page script) */
function mask(){
  $$('.shot').forEach(function(f){
    if($('.mask',f))return;var im=$('img',f);if(!im)return;
    var m=document.createElement('div');m.className='mask';f.insertBefore(m,im);m.appendChild(im);
  });
}
mask();

/* 8. count-up numbers */
function count(el){
  var m=el.textContent.match(/^(\d+)(.*)$/);if(!m||RM)return;
  var to=+m[1],suf=m[2],t0=null,d=1600;
  var f=function(t){if(!t0)t0=t;var p=Math.min((t-t0)/d,1),e=1-Math.pow(1-p,4);el.textContent=Math.round(to*e)+suf;if(p<1)requestAnimationFrame(f)};
  el.textContent='0'+suf;requestAnimationFrame(f);
}
var cio=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){count(e.target);cio.unobserve(e.target)}})},{threshold:.6});
$$('.stats b,.glass b').forEach(function(b){if(/^\d/.test(b.textContent))cio.observe(b)});

/* 9. pointer sheen, tilt, magnetic buttons, cursor ring (fine pointers) */
if(FINE&&!RM){
  var hostSel='.tier,.ev,.quotes blockquote';
  document.addEventListener('pointermove',function(e){
    var t=e.target.closest&&e.target.closest(hostSel);if(!t)return;
    var r=t.getBoundingClientRect(),px=(e.clientX-r.left)/r.width,py=(e.clientY-r.top)/r.height;
    t.style.setProperty('--mx',(px*100)+'%');t.style.setProperty('--my',(py*100)+'%');
    t.style.transform=(t.classList.contains('pick')?'translateY(-12px) ':'')+'perspective(900px) rotateX('+((.5-py)*4)+'deg) rotateY('+((px-.5)*5)+'deg)';
  });
  document.addEventListener('pointerout',function(e){var t=e.target.closest&&e.target.closest(hostSel);if(t&&!t.contains(e.relatedTarget))t.style.transform=''});
  $$('.btn.gold,.btn.line,.fab').forEach(function(b){
    b.classList.add('mag');
    b.addEventListener('pointermove',function(e){var r=b.getBoundingClientRect();b.style.translate=((e.clientX-r.left-r.width/2)*.18)+'px '+((e.clientY-r.top-r.height/2)*.3)+'px'});
    b.addEventListener('pointerleave',function(){b.style.translate=''});
  });
  var cur=document.createElement('div');cur.id='cur';document.body.appendChild(cur);
  var cx=0,cy=0,tx=0,ty=0;
  addEventListener('pointermove',function(e){tx=e.clientX;ty=e.clientY;cur.classList.add('on')});
  document.addEventListener('pointerover',function(e){cur.classList.toggle('hov',!!(e.target.closest&&e.target.closest('a,button,summary,.gi')))});
  document.documentElement.addEventListener('pointerleave',function(){cur.classList.remove('on')});
  (function mv(){cx+=(tx-cx)*.18;cy+=(ty-cy)*.18;cur.style.transform='translate('+cx+'px,'+cy+'px)';requestAnimationFrame(mv)})();
}
onScroll();
})();
