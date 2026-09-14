/**
 * Klavye girdisi. Çıktı -1..+1 aralığında analog komutlar; aynı arayüz ileride
 * dokunmatik kontrollerle de beslenecek, böylece girdi işleme tek kaynaklı kalır.
 */
export interface DriveInput {
  /** +1 ileri gaz, -1 geri. */
  throttle: number;
  /** El freni basılı mı. */
  handbrake: boolean;
}

const FORWARD = new Set(['ArrowRight', 'KeyD']);
const REVERSE = new Set(['ArrowLeft', 'KeyA']);

export class Keyboard {
  private readonly down = new Set<string>();
  /** R'ye basıldığı karede bir kez true olur. */
  resetRequested = false;
  /** Q'ya basıldığı karede bir kez true olur. */
  outriggerToggled = false;

  constructor(target: EventTarget = window) {
    target.addEventListener('keydown', (e) => {
      const ev = e as KeyboardEvent;
      if (ev.repeat) return;
      this.down.add(ev.code);
      if (ev.code === 'KeyR') this.resetRequested = true;
      if (ev.code === 'KeyQ') this.outriggerToggled = true;
      // Boşluk ve ok tuşları sayfayı kaydırmasın.
      if (ev.code === 'Space' || ev.code.startsWith('Arrow')) ev.preventDefault();
    });
    target.addEventListener('keyup', (e) => this.down.delete((e as KeyboardEvent).code));
    // Sekme arkaplana geçerse basılı tuşlar takılı kalmasın.
    window.addEventListener('blur', () => this.down.clear());
  }

  readDrive(): DriveInput {
    let throttle = 0;
    for (const k of FORWARD) if (this.down.has(k)) throttle += 1;
    for (const k of REVERSE) if (this.down.has(k)) throttle -= 1;
    return { throttle: Math.max(-1, Math.min(1, throttle)), handbrake: this.down.has('Space') };
  }

  consumeReset(): boolean {
    const r = this.resetRequested;
    this.resetRequested = false;
    return r;
  }

  consumeOutriggerToggle(): boolean {
    const r = this.outriggerToggled;
    this.outriggerToggled = false;
    return r;
  }
}
