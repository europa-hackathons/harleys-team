// Big, readable text over the game: corner labels (score, timer, lives) and a centre banner.
//   hud.set('score', '⭐ 3')                     top-left by default
//   hud.set('time', '⏱ 42', 'top-right')        corners: top-left, top-right, bottom-left, bottom-right
//   hud.banner('YOU WIN! 🎉', 2000)              centre message for 2 s (0 = stays until hud.banner(''))
const style = document.createElement('style');
style.textContent = `
.kit-hud{position:fixed;z-index:10;padding:8px 18px;border-radius:14px;pointer-events:none;color:#fff;
  font:bold clamp(18px,3vw,30px) "Trebuchet MS",system-ui,sans-serif;background:rgba(20,10,46,.65)}
.kit-top-left{top:14px;left:14px}.kit-top-right{top:14px;right:14px}
.kit-bottom-left{bottom:14px;left:14px}.kit-bottom-right{bottom:14px;right:14px}
.kit-banner{position:fixed;inset:0;z-index:11;display:flex;align-items:center;justify-content:center;pointer-events:none;
  text-align:center;padding:16px;font:bold clamp(36px,8vw,90px) "Trebuchet MS",system-ui,sans-serif;color:#ffd93b;
  text-shadow:0 .08em 0 #ff6b9a,0 0 .4em rgba(0,0,0,.5);transition:opacity .3s,transform .3s}
.kit-banner.kit-hidden{opacity:0;transform:scale(.8)}`;
document.head.append(style);

const labels = {};
const banner = document.createElement('div');
banner.className = 'kit-banner kit-hidden';
document.body.append(banner);
let bannerTimer = 0;

export const hud = {
  set(name, text, corner = 'top-left') {
    let el = labels[name];
    if (!el) {
      el = labels[name] = document.createElement('div');
      el.className = `kit-hud kit-${corner}`;
      document.body.append(el);
    }
    el.textContent = text;
    el.style.display = text === '' ? 'none' : '';
  },
  banner(text, ms = 1800) {
    clearTimeout(bannerTimer);
    banner.textContent = text;
    banner.classList.toggle('kit-hidden', !text);
    if (text && ms) bannerTimer = setTimeout(() => banner.classList.add('kit-hidden'), ms);
  },
};
