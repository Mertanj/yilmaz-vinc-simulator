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

/** Vinç eksenleri, -1..+1. Gerçek kumandada her fonksiyon ayrı kol. */
export interface CraneAxes {
  luff: number;
  telescope: number;
  winch: number;
}

export class Keyboard {
  private readonly down = new Set<string>();
  /** R'ye basıldığı karede bir kez true olur. */
  resetRequested = false;
  /** Q'ya basıldığı karede bir kez true olur. */
  outriggerToggled = false;
  /** Boşluğa basıldığı karede bir kez true olur. */
  hookToggled = false;
  /** K'ya basıldığı karede bir kez true olur — halat kat sayısı. */
  katToggled = false;
  /** I'ya basıldığı karede bir kez true olur — panelin detay satırları. */
  detayToggled = false;

  constructor(target: EventTarget = window) {
    target.addEventListener('keydown', (e) => {
      const ev = e as KeyboardEvent;
      if (ev.repeat) return;
      this.down.add(ev.code);
      if (ev.code === 'KeyR') this.resetRequested = true;
      if (ev.code === 'KeyQ') this.outriggerToggled = true;
      if (ev.code === 'Space') this.hookToggled = true;
      if (ev.code === 'KeyK') this.katToggled = true;
      if (ev.code === 'KeyI') this.detayToggled = true;
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

  /**
   * Vinç kumandası — A şeması: her fonksiyon kendi tuşunda.
   * W/S bom kaldır-indir, Shift+W/S teleskop, yukarı/aşağı ok vinç.
   * Shift bomu teleskopa çeviriyor: gerçek kumandada iki ayrı kol olurdu,
   * klavyede aynı elin altında kalması daha rahat.
   */
  readCrane(): CraneAxes {
    const shift = this.down.has('ShiftLeft') || this.down.has('ShiftRight');
    const up = this.down.has('KeyW') ? 1 : 0;
    const dn = this.down.has('KeyS') ? 1 : 0;
    const axis = up - dn;
    return {
      luff: shift ? 0 : axis,
      telescope: shift ? axis : 0,
      winch: (this.down.has('ArrowUp') ? 1 : 0) - (this.down.has('ArrowDown') ? 1 : 0),
    };
  }

  /** Space, faza göre: sürerken el freni, ayaklar yerdeyken kanca bağla/bırak. */
  consumeHookToggle(): boolean {
    const r = this.hookToggled;
    this.hookToggled = false;
    return r;
  }

  consumeOutriggerToggle(): boolean {
    const r = this.outriggerToggled;
    this.outriggerToggled = false;
    return r;
  }

  consumeKatToggle(): boolean {
    const r = this.katToggled;
    this.katToggled = false;
    return r;
  }

  /** Panelin detay satırlarını aç/kapa. */
  consumeDetayToggle(): boolean {
    const r = this.detayToggled;
    this.detayToggled = false;
    return r;
  }
}
