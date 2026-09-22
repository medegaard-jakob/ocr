/**
 * Getting at the camera, shared by both scanner flows.
 *
 * The browser owns the real permission, and on iOS it isn't kept between
 * launches of a home-screen web app, so the scanner asks again on every
 * launch no matter what we do. What we can avoid is making the supervisor
 * tap through an explainer first every single time: choosing to scan already
 * says why the camera is wanted, so this asks as soon as a scanner opens.
 *
 * Shared rather than copied per screen so a refusal in one scanner is
 * honoured by the other -- two copies would each nag on their own schedule.
 */

import { useCameraPermissions } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import { showAlert } from './alert';
import { CameraAskOutcome, loadCameraAskOutcome, saveCameraAskOutcome } from './storage';

// Set when an ask comes back without permission, for any reason. Module scope
// because scanners unmount every time you step back to Home, and re-asking
// unprompted on each return would be nagging. Resets on a fresh launch, which
// is when a failure worth retrying (a camera that wasn't plugged in, a
// browser that wanted a tap first) is most likely to have changed.
let autoAskBlockedThisSession = false;

export function useCameraAccess() {
  const [permission, requestPermission] = useCameraPermissions();
  const [askOutcome, setAskOutcome] = useState<CameraAskOutcome | null>(null);
  // True while the browser's own prompt is up, so callers don't render an
  // explainer behind it -- a "Grant camera permission" button sitting behind a
  // live permission dialog reads as two competing asks.
  const [asking, setAsking] = useState(false);
  const autoAskedRef = useRef(false);

  useEffect(() => {
    loadCameraAskOutcome().then(setAskOutcome);
  }, []);

  /**
   * `explicit` means they tapped a button asking for the camera, rather than
   * this being the automatic ask when the scanner opened. Only the explicit
   * answer is remembered across launches: a failed automatic ask is not a
   * decision. expo-camera reports "no camera on this machine" the same way it
   * reports "the person said no", and a browser that insists on a tap before
   * opening the camera looks identical again -- storing any of those as a
   * refusal would silently switch the automatic ask off forever over
   * something the supervisor never chose.
   */
  const ask = async (explicit: boolean) => {
    setAsking(true);
    try {
      const result = await requestPermission();
      if (result.granted) {
        setAskOutcome('granted');
        saveCameraAskOutcome('granted');
        return;
      }
      autoAskBlockedThisSession = true;
      if (explicit) {
        setAskOutcome('denied');
        saveCameraAskOutcome('denied');
        showAlert(
          'Camera access unavailable',
          result.canAskAgain === false
            ? 'Camera permission was denied. Enable it in your browser/system settings, or use "Enter manually" below.'
            : 'Camera access was not granted. Use "Enter manually" below to try the rest of the app.',
        );
      }
    } catch (err) {
      autoAskBlockedThisSession = true;
      if (explicit) {
        showAlert(
          'Camera access unavailable',
          `This environment blocked camera access (${err instanceof Error ? err.message : String(err)}). ` +
            'Use "Enter manually" below to try the rest of the app.',
        );
      }
    } finally {
      setAsking(false);
    }
  };

  // The one case this stays quiet in is after a refusal -- asking unprompted
  // every time a scanner opens would be nagging, and that's when an explainer
  // with a button earns its place instead.
  useEffect(() => {
    if (autoAskedRef.current || !permission || askOutcome === null) return;
    autoAskedRef.current = true;
    if (permission.granted || !permission.canAskAgain) return;
    if (askOutcome === 'denied' || autoAskBlockedThisSession) return;
    void ask(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permission, askOutcome]);

  return {
    permission,
    /** False while the permission state or the stored outcome is still loading. */
    resolved: !!permission && askOutcome !== null,
    asking,
    ask,
  };
}
