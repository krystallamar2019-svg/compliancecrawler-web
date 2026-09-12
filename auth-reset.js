(()=>{
  const SUPABASE_URL='https://pbprkgkvsxkpdhsmjzrc.supabase.co';
  const SUPABASE_KEY='sb_publishable_UBCXWvPIRsU1SLpwZzGvig_dSIJYSjO';
  if(!window.supabase)return;
  const recoveryClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);

  function authStatus(message,isError=false){
    const el=document.getElementById('authStatus');
    if(!el)return;
    el.textContent=message||'';
    el.className=el.className.replace(/\s?(show|error)/g,'').trim();
    if(message)el.classList.add('show');
    if(isError)el.classList.add('error');
  }

  function addForgotButton(){
    const form=document.getElementById('authForm');
    if(!form||document.getElementById('forgotPasswordBtn'))return;
    const btn=document.createElement('button');
    btn.type='button';
    btn.id='forgotPasswordBtn';
    btn.textContent='Forgot password?';
    btn.style.cssText='background:none;border:0;color:#0B6477;font-weight:700;cursor:pointer;padding:8px 0 0;text-decoration:underline;text-underline-offset:3px;';
    btn.addEventListener('click',async()=>{
      const email=(document.getElementById('authEmail')?.value||'').trim();
      if(!email){authStatus('Enter your email address first.',true);return;}
      btn.disabled=true;
      authStatus('Sending password reset email…');
      const {error}=await recoveryClient.auth.resetPasswordForEmail(email,{redirectTo:location.origin+'/'});
      btn.disabled=false;
      if(error){authStatus(error.message||'Unable to send password reset email.',true);return;}
      authStatus('Password reset email sent. Open the newest email from BrandedAlign/Supabase and click the reset link.');
    });
    form.appendChild(btn);
  }

  function showResetModal(){
    if(document.getElementById('baResetOverlay'))return;
    const overlay=document.createElement('div');
    overlay.id='baResetOverlay';
    overlay.style.cssText='position:fixed;inset:0;z-index:99999;background:rgba(16,42,58,.62);display:grid;place-items:center;padding:20px;';
    overlay.innerHTML=`<div style="width:min(520px,100%);background:#fffdf7;border-radius:24px;padding:30px;box-shadow:0 30px 90px rgba(16,42,58,.28);font-family:inherit"><div style="font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#0B6477;font-weight:800">Secure account</div><h2 style="margin:8px 0 10px;color:#102A3A">Choose a new password</h2><p style="color:#5d7078;margin:0 0 18px">Use at least 8 characters.</p><label style="display:block;font-weight:700;color:#173A4D;margin-bottom:6px">New password</label><input id="baNewPassword" type="password" minlength="8" autocomplete="new-password" style="width:100%;box-sizing:border-box;padding:14px;border:1px solid #b9c7ca;border-radius:12px;margin-bottom:12px;font:inherit"><label style="display:block;font-weight:700;color:#173A4D;margin-bottom:6px">Confirm password</label><input id="baConfirmPassword" type="password" minlength="8" autocomplete="new-password" style="width:100%;box-sizing:border-box;padding:14px;border:1px solid #b9c7ca;border-radius:12px;margin-bottom:12px;font:inherit"><div id="baResetStatus" style="min-height:22px;color:#8a3f38;font-size:13px;margin-bottom:8px"></div><button id="baSavePassword" type="button" style="width:100%;border:0;border-radius:14px;padding:14px;background:#0B6477;color:white;font-weight:800;cursor:pointer">Save new password →</button></div>`;
    document.body.appendChild(overlay);
    document.getElementById('baSavePassword').addEventListener('click',async()=>{
      const p=document.getElementById('baNewPassword').value;
      const c=document.getElementById('baConfirmPassword').value;
      const status=document.getElementById('baResetStatus');
      if(p.length<8){status.textContent='Password must be at least 8 characters.';return;}
      if(p!==c){status.textContent='Passwords do not match.';return;}
      const btn=document.getElementById('baSavePassword');
      btn.disabled=true;btn.textContent='Saving…';
      const {error}=await recoveryClient.auth.updateUser({password:p});
      if(error){status.textContent=error.message||'Unable to update password.';btn.disabled=false;btn.textContent='Save new password →';return;}
      status.style.color='#0B6477';
      status.textContent='Password updated. You are signed in.';
      setTimeout(()=>{overlay.remove();history.replaceState({},'',location.pathname+location.search);location.reload();},900);
    });
  }

  recoveryClient.auth.onAuthStateChange((event)=>{
    if(event==='PASSWORD_RECOVERY')showResetModal();
  });

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',addForgotButton);else addForgotButton();
})();
