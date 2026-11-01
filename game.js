
/* ======================================
   AQBATTLE - MOBILE BATTLE CONTROLS
   Landscape touchscreen HUD
====================================== */

(() => {
  if (document.getElementById("aq-mobile-hud")) return;

  const style = document.createElement("style");
  style.textContent = `
    #aq-mobile-hud {
      position: fixed;
      inset: 0;
      z-index: 9999;
      pointer-events: none;
      color: white;
      font-family: Arial, sans-serif;
      user-select: none;
      -webkit-user-select: none;
      touch-action: none;
    }

    #aq-mobile-hud * {
      box-sizing: border-box;
    }

    .aq-btn, #aq-stick {
      pointer-events: auto;
      touch-action: none;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      background: rgba(20, 27, 35, .72);
      border: 2px solid rgba(255,255,255,.65);
      border-radius: 50%;
      box-shadow: 0 3px 12px #0008;
      font-weight: bold;
      text-shadow: 1px 2px 3px black;
    }

    .aq-btn {
      position: absolute;
      width: clamp(48px, 7vw, 76px);
      height: clamp(48px, 7vw, 76px);
      font-size: clamp(10px, 1.5vw, 14px);
    }

    .aq-btn:active {
      background: rgba(220, 165, 35, .85);
      transform: scale(.94);
    }

    #aq-stick {
      position: absolute;
      left: 5%;
      bottom: 9%;
      width: clamp(105px, 17vw, 155px);
      height: clamp(105px, 17vw, 155px);
      border-color: #ffffff88;
      background: rgba(30, 40, 50, .38);
    }

    #aq-stick-knob {
      width: 42%;
      height: 42%;
      border-radius: 50%;
      background: rgba(210,220,230,.65);
      border: 2px solid white;
      box-shadow: 0 2px 8px #0008;
      transform: translate(0,0);
    }

    #aq-fire {
      right: 7%;
      bottom: 17%;
      width: clamp(75px, 10vw, 105px);
      height: clamp(75px, 10vw, 105px);
      background: rgba(180, 45, 30, .78);
      border-color: #ffb4a5;
      font-size: 15px;
    }

    #aq-aim { right: 20%; bottom: 25%; }
    #aq-scope { right: 20%; bottom: 8%; }
    #aq-jump { right: 7%; bottom: 4%; }
    #aq-crouch { right: 30%; bottom: 5%; }
    #aq-prone { right: 40%; bottom: 5%; }
    #aq-reload { right: 7%; bottom: 48%; }
    #aq-medkit { left: 5%; bottom: 29%; }
    #aq-backpack { left: 15%; bottom: 9%; }
    #aq-sprint { left: 15%; bottom: 29%; }
    #aq-map { right: 5%; top: 7%; }
    #aq-weapon { right: 31%; bottom: 25%; }

    #aq-status {
      position: absolute;
      top: 5%;
      left: 50%;
      transform: translateX(-50%);
      padding: 8px 16px;
      background: #101820bb;
      border: 1px solid #ffffff55;
      border-radius: 8px;
      font-size: 12px;
      letter-spacing: 1px;
    }

    @media (orientation: portrait) {
      #aq-mobile-hud::after {
        content: "ROTATE YOUR DEVICE TO LANDSCAPE";
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #080d15ee;
        font-weight: bold;
        letter-spacing: 2px;
        font-size: 16px;
        pointer-events: auto;
      }
    }
  `;
  document.head.appendChild(style);

  const hud = document.createElement("div");
  hud.id = "aq-mobile-hud";

  hud.innerHTML = `
    <div id="aq-status">AQBATTLE • BATTLE ROYALE</div>

    <div id="aq-stick">
      <div id="aq-stick-knob"></div>
    </div>

    <button class="aq-btn" id="aq-sprint">SPRINT</button>
    <button class="aq-btn" id="aq-medkit">MEDKIT</button>
    <button class="aq-btn" id="aq-backpack">BAG</button>

    <button class="aq-btn" id="aq-fire">FIRE</button>
    <button class="aq-btn" id="aq-aim">AIM</button>
    <button class="aq-btn" id="aq-scope">SCOPE</button>
    <button class="aq-btn" id="aq-jump">JUMP</button>
    <button class="aq-btn" id="aq-crouch">CROUCH</button>
    <button class="aq-btn" id="aq-prone">PRONE</button>
    <button class="aq-btn" id="aq-reload">RELOAD</button>
    <button class="aq-btn" id="aq-map">MAP</button>
    <button class="aq-btn" id="aq-weapon">WEAPON</button>
  `;

  document.body.appendChild(hud);

  function sendAction(action, active = true, detail = {}) {
    window.dispatchEvent(new CustomEvent("aqbattle:action", {
      detail: { action, active, ...detail }
    }));
  }

  // Movement joystick
  const stick = document.getElementById("aq-stick");
  const knob = document.getElementById("aq-stick-knob");

  let stickPointer = null;

  function moveStick(event) {
    const rect = stick.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let dx = event.clientX - centerX;
    let dy = event.clientY - centerY;

    const maxDistance = rect.width * 0.30;
    const distance = Math.hypot(dx, dy);

    if (distance > maxDistance) {
      dx = dx / distance * maxDistance;
      dy = dy / distance * maxDistance;
    }

    knob.style.transform = `translate(${dx}px, ${dy}px)`;

    sendAction("move", true, {
      x: dx / maxDistance,
      y: -dy / maxDistance
    });
  }

  stick.addEventListener("pointerdown", event => {
    event.preventDefault();
    stickPointer = event.pointerId;
    stick.setPointerCapture(stickPointer);
    moveStick(event);
  });

  stick.addEventListener("pointermove", event => {
    if (event.pointerId === stickPointer) moveStick(event);
  });

  function stopStick(event) {
    if (event.pointerId !== stickPointer) return;

    stickPointer = null;
    knob.style.transform = "translate(0,0)";
    sendAction("move", false, { x: 0, y: 0 });
  }

  stick.addEventListener("pointerup", stopStick);
  stick.addEventListener("pointercancel", stopStick);

  // Buttons
  const buttonActions = {
    "aq-fire": "fire",
    "aq-aim": "aim",
    "aq-scope": "scope",
    "aq-jump": "jump",
    "aq-crouch": "crouch",
    "aq-prone": "prone",
    "aq-reload": "reload",
    "aq-medkit": "medkit",
    "aq-backpack": "backpack",
    "aq-sprint": "sprint",
    "aq-map": "map",
    "aq-weapon": "switchWeapon"
  };

  Object.entries(buttonActions).forEach(([id, action]) => {
    const button = document.getElementById(id);

    button.addEventListener("pointerdown", event => {
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      sendAction(action, true);
    });

    const release = event => {
      sendAction(action, false);
    };

    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
  });

  // Connect your existing game logic to these events.
  window.addEventListener("aqbattle:action", event => {
    const { action, active, x, y } = event.detail;

    // Example: movement values are between -1 and 1.
    // Connect these values to your existing player movement code.
    if (action === "move") {
      window.aqbattleMovement = { x, y, active };
    }

    // Other actions are available to your game code
    // through the aqbattle:action event.
  });

  console.log("AQBATTLE mobile controls loaded!");
})();
