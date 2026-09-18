function copyCode(code, button){
  navigator.clipboard.writeText(code).then(()=>{
    const old=button.textContent;
    button.textContent="Kimásolva ✓";
    setTimeout(()=>button.textContent=old,1200);
  });
}