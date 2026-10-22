# Kiosk setup — Windows laptop → 2 LED walls

Screen 1 (main LED wall) = welcome spotlight + photo wall.
Screen 2 (second LED wall) = crown word cloud.

## 1. Before you start
- Get the **LED processor input resolution** for each wall from the LED vendor. If it differs from
  1248 × 1170, change `src/config/stage.ts` and redeploy (the screens scale to fit anyway, but the
  stage size should match the wall's aspect for a pixel-perfect picture).
- Laptop on mains power, wired Ethernet preferred (phone hotspot as backup).
- Chrome installed and updated.

## 2. Windows settings
1. **Settings → System → Display**: choose **Extend these displays**. Arrange: laptop, Wall 1, Wall 2 (left → right).
   Set each wall output to the LED processor's input resolution. **Scale = 100 %** on both walls.
2. **Power**: plugged in, *Best performance*; screen off / sleep = **Never**; lid close = **Do nothing**.
3. **Focus / Do Not Disturb** on. **Pause Windows Update** for 1 week. Taskbar → *Automatically hide*.
4. Chrome → Settings → System → **Use graphics acceleration when available** = on. Check `chrome://gpu`: Canvas should say "Hardware accelerated".
   Use Chrome for the screens, not Opera GX (its GX Control CPU/RAM limiters and battery saver throttle the animation).

## 3. Launch the screens
Find each wall's left x-coordinate (Display settings shows the arrangement; e.g. laptop 1920 wide →
Wall 1 starts at x=1920, Wall 2 at 1920 + Wall 1 width). Then run (one line each, in `cmd`):

```bat
start chrome --kiosk --user-data-dir=C:\kiosk-welcome --window-position=1920,0 https://<domain>/screen/main/welcome
start chrome --kiosk --user-data-dir=C:\kiosk-cloud   --window-position=3168,0 https://<domain>/screen/main/cloud
```

Tip: save both lines as `launch-walls.bat` on the desktop.

- Separate `--user-data-dir` folders keep the two windows independent.
- To leave kiosk mode: **Alt+F4** on that window.
- For rehearsals use `/screen/dev/welcome` and `/screen/dev/cloud`.

## 4. Check
Add `?debug=1` to a URL to see FPS, attendee count, queue, stage size and sync state:
`https://<domain>/screen/main/welcome?debug=1`. You want **fps 60** and **synced: yes**. Then relaunch without `?debug=1`.

## 5. Two-laptop fallback (preferred if available)
One laptop per wall, each running only its own launch line with `--window-position=<wall x>,0`.
