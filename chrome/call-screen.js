globalThis.blackBubbleCallScreen = {
  css: `
    #call {
      --call-script: "Black Bubble Allura";
      background: #fafafa;
      color: #171717;
      font: 16px/1.4 system-ui, sans-serif;
    }
    .call-layout {
      width: 100%; height: 100%; min-height: 320px;
      display: grid; grid-template-rows: auto 1fr auto; text-align: center;
      padding: max(24px, env(safe-area-inset-top)) 24px max(24px, env(safe-area-inset-bottom));
    }
    .call-heading {
      margin: 0; color: #666; font: 500 11px/1.5 system-ui, sans-serif;
      letter-spacing: .08em; font-variant-numeric: tabular-nums;
    }
    .call-center {
      align-self: center; justify-self: center; display: grid; justify-items: center;
      width: 100%; text-align: center;
    }
    .orb {
      position: relative; width: clamp(100px, min(54vw, 32dvh), 290px);
      aspect-ratio: 1; color: #151515;
    }
    .orb::before, .orb::after, .orb-core {
      position: absolute; inset: 0; border-radius: 50%; box-sizing: border-box;
    }
    .orb-core { background: currentColor; }
    .orb-edge { display: none; width: 100%; height: 100%; fill: currentColor; overflow: visible; }
    #call:is([data-phase="listening"], [data-phase="voice"]) .orb-core {
      animation: bb-breathe 4.4s ease-in-out infinite;
    }
    @keyframes bb-breathe {
      0%, 100% { transform: scale(.94); }
      50% { transform: scale(1.035); }
    }

    /* Three closed contours with matching cubic segments interpolate continuously. */
    .orb-edge path {
      --crest: path("M50.0 -1.0 C55.6 -1.0 62.8 4.8 66.9 9.3 C71.0 13.7 71.6 21.1 74.5 25.5 C77.3 30.0 80.6 31.8 84.1 35.9 C87.6 40.0 93.9 44.6 95.5 50.0 C97.1 55.4 96.1 63.0 93.5 68.0 C90.9 73.0 84.7 76.8 80.0 80.0 C75.3 83.1 70.3 85.2 65.3 86.9 C60.3 88.5 55.1 90.0 50.0 90.0 C44.9 90.0 39.7 88.5 34.7 86.9 C29.7 85.2 24.7 83.1 20.0 80.0 C15.3 76.8 9.1 73.0 6.5 68.0 C3.9 63.0 2.9 55.4 4.5 50.0 C6.1 44.6 12.4 40.0 15.9 35.9 C19.4 31.8 22.7 30.0 25.5 25.5 C28.4 21.1 29.0 13.7 33.1 9.3 C37.2 4.8 44.4 -1.0 50.0 -1.0 Z");
      --swell: path("M50.0 12.5 C55.2 12.9 60.2 12.2 65.1 13.4 C70.1 14.7 75.8 16.7 79.9 20.1 C84.1 23.4 87.5 28.4 90.0 33.4 C92.5 38.4 94.9 44.4 95.0 50.0 C95.2 55.6 93.9 62.4 90.9 67.0 C88.0 71.5 81.7 74.5 77.2 77.2 C72.6 79.8 68.2 80.3 63.6 82.9 C59.1 85.5 55.5 90.7 50.0 93.0 C44.5 95.3 36.0 98.5 30.7 96.6 C25.4 94.8 20.2 87.5 18.1 81.9 C15.9 76.4 18.6 68.6 18.0 63.2 C17.4 57.9 16.2 55.1 14.5 50.0 C12.8 44.9 7.6 38.3 7.7 32.5 C7.9 26.7 11.0 18.9 15.3 15.3 C19.7 11.7 28.0 11.4 33.8 10.9 C39.6 10.4 44.8 12.1 50.0 12.5 Z");
      --ebb: path("M50.0 12.5 C55.2 12.1 60.4 10.4 66.2 10.9 C72.0 11.4 80.3 11.7 84.7 15.3 C89.0 18.9 92.1 26.7 92.3 32.5 C92.4 38.3 87.2 44.9 85.5 50.0 C83.8 55.1 82.6 57.9 82.0 63.2 C81.4 68.6 84.1 76.4 81.9 81.9 C79.8 87.5 74.6 94.8 69.3 96.6 C64.0 98.5 55.5 95.3 50.0 93.0 C44.5 90.7 40.9 85.5 36.4 82.9 C31.8 80.3 27.4 79.8 22.8 77.2 C18.3 74.5 12.0 71.5 9.1 67.0 C6.1 62.4 4.8 55.6 5.0 50.0 C5.1 44.4 7.5 38.4 10.0 33.4 C12.5 28.4 15.9 23.4 20.1 20.1 C24.2 16.7 29.9 14.7 34.9 13.4 C39.8 12.2 44.8 12.9 50.0 12.5 Z");
      d: var(--crest);
    }
    #call:is([data-phase="sending"], [data-phase="thinking"], [data-phase="playback"]) .orb-core { display: none; }
    #call:is([data-phase="sending"], [data-phase="thinking"], [data-phase="playback"]) .orb-edge { display: block; }
    #call:is([data-phase="sending"], [data-phase="thinking"], [data-phase="playback"]) path {
      animation: bb-wave 3.9s linear infinite;
    }
    @keyframes bb-wave {
      0%, 100% { d: var(--crest); }
      33.333% { d: var(--swell); }
      66.667% { d: var(--ebb); }
    }

    #call[data-phase="speaking"] .orb-core { transform: scale(.70); }
    #call[data-phase="speaking"] .orb::before, #call[data-phase="speaking"] .orb::after {
      content: ""; border: 2px solid currentColor;
      animation: bb-echo 2.2s cubic-bezier(.2,.48,.52,.91) infinite;
    }
    #call[data-phase="speaking"] .orb::after { animation-delay: -1.1s; }
    @keyframes bb-echo {
      from { transform: scale(.70); opacity: .9; }
      to { transform: scale(1.13); opacity: 0; }
    }
    #call[data-phase="paused"] .orb-core {
      background: transparent; border: 2px solid #777; transform: scale(.76);
    }
    @media (prefers-reduced-motion: reduce) {
      #call .orb *, #call .orb::before, #call .orb::after { animation: none !important; }
      #call[data-phase="speaking"] .orb::before { transform: scale(.86); opacity: .75; }
      #call[data-phase="speaking"] .orb::after { transform: scale(1.04); opacity: .45; }
    }

    #orb-status {
      margin: clamp(16px, 3dvh, 32px) 0 0; color: #171717;
      font: 400 clamp(44px, calc(32px + 1.8vw), 62px)/1.18 var(--call-script), cursive;
      letter-spacing: normal;
    }
    #call-detail { display: none; }
    #call:is([data-phase="voice"], [data-phase="paused"]) #call-detail {
      display: block; max-width: 38ch; margin: 6px 0 0; color: #555;
      font: 400 14px/1.5 system-ui, sans-serif; text-wrap: pretty;
    }
    .call-actions { display: flex; justify-content: center; }
    #end-loop {
      display: grid; place-items: center; width: 48px; height: 48px; padding: 0;
      border: 1px solid #bdbdbd; border-radius: 50%; background: transparent; color: #242424;
    }
    #end-loop::before {
      content: ""; width: 12px; height: 12px; background: currentColor; border-radius: 2px;
    }
    #call[data-phase="paused"] #end-loop::before {
      width: 10px; height: 10px; border: solid currentColor; border-width: 0 0 2px 2px;
      background: transparent; border-radius: 0; transform: translateX(2px) rotate(45deg);
    }
    #end-loop:hover { background: #ededed; }
    #end-loop:focus-visible { outline: 2px solid currentColor; outline-offset: 4px; }
    #resize-call {
      position:absolute; top:max(16px, env(safe-area-inset-top)); right:max(18px, env(safe-area-inset-right));
      display:grid; place-items:center; width:44px; height:44px; padding:0;
      border:1px solid #c9c9c9; border-radius:50%; background:#fafafa; color:#292929;
    }
    #resize-call:hover { background:#ededed; }
    #resize-call svg { width:18px; height:18px; fill:none; stroke:currentColor; stroke-width:1.6; stroke-linecap:round; stroke-linejoin:round; }
    #resize-call:focus-visible { outline:2px solid #242424; outline-offset:2px; }
    #call[data-size="small"] {
      inset:auto max(12px,env(safe-area-inset-right)) max(96px,14dvh,env(safe-area-inset-bottom)) auto;
      width:min(268px,calc(100vw - 24px)); max-height:70dvh;
      border:1px solid #bdbdbd; border-radius:24px; box-shadow:0 4px 18px #0002;
    }
    #call[data-size="small"] .call-layout {
      height:auto; min-height:0; padding:10px 9px 10px 15px; align-items:center;
      grid-template-columns:40px minmax(0,1fr) 44px 44px; grid-template-rows:auto auto auto;
      grid-template-areas:"orb build resize stop" "orb word resize stop" "reason reason reason reason";
      column-gap:4px; text-align:left;
    }
    #call[data-size="small"] :is(.call-center,.call-actions) { display:contents; }
    #call[data-size="small"] .call-heading { grid-area:build; margin-left:6px; font-size:10px; }
    #call[data-size="small"] .orb { grid-area:orb; width:35px; justify-self:center; }
    #call[data-size="small"] #orb-status { grid-area:word; margin:0 0 0 5px; font-size:31px; line-height:1; }
    #call[data-size="small"] #call-detail { grid-area:reason; margin:8px 3px 2px; line-height:1.4; }
    #call[data-size="small"] #resize-call { grid-area:resize; position:static; border-color:transparent; }
    #call[data-size="small"] #end-loop { grid-area:stop; width:44px; height:44px; }
  `,
  addOrb(center) {
    const orb = document.createElement("div");
    orb.className = "orb";
    orb.setAttribute("aria-hidden", "true");
    const core = document.createElement("span");
    core.className = "orb-core";
    const edge = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    edge.setAttribute("class", "orb-edge");
    edge.setAttribute("viewBox", "0 0 100 100");
    edge.append(document.createElementNS(edge.namespaceURI, "path"));
    orb.append(core, edge);
    center.append(orb);
  }
};
