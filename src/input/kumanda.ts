/**
 * Makinenin kumandası: basılı tutulan komutlar ve bir karelik tetikler.
 *
 * Dosya eskiden `keyboard.ts` idi ve sadece klavyeyi dinliyordu; baştaki not da
 * *"aynı arayüz ileride dokunmatik kontrollerle de beslenecek"* diyordu. Artık
 * besleniyor, dolayısıyla adı da klavye değil kumanda.
 *
 * İki kaynak var ama ikisi AYNI DİLİ konuşmuyor, bilerek: klavye TUŞ söylüyor
 * (`KeyW`, `ShiftLeft`), dokunmatik pad NİYET söylüyor (`kaldir`, `yatGeri`).
 * Ekrandaki düğmenin Shift+W'nin direk eğimi demek olduğunu bilmesi gerekmez —
 * o klavyenin kendi kestirmesi. İkisi de okuma anında aynı eksende birleşiyor,
 * ve ikisi aynı anda çalışıyor: klavyeli tablette iki kumanda da açık.
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
  /** Dördüncü eksen — dirsekli bomun hidrolik uzatması. */
  uzat: number;
  winch: number;
}

/** Dokunmatik padin basılı tutulabilen komutları. */
export type Komut =
  | 'ileri' | 'geri' | 'fren'
  | 'kaldir' | 'indir' | 'yatGeri' | 'yatOn'
  | 'kancaYukari' | 'kancaAsagi' | 'bomKaldir' | 'bomIndir'
  | 'teleskopUzat' | 'teleskopKis' | 'uzamaAc' | 'uzamaKis';

/** Dokunmatik padin bir karelik tetikleri. */
export type Tetik = 'sifirla' | 'cikis' | 'detay' | 'kanca' | 'ayaklar' | 'kat';

const birlestir = (n: number): number => Math.max(-1, Math.min(1, n));

export class Kumanda {
  private readonly down = new Set<string>();
  /** Dokunmatik padde şu an basılı tutulan komutlar. */
  private readonly basili = new Set<Komut>();
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
  /** Esc'e basıldığı karede bir kez true olur — araç seçimine dön. */
  cikisIstendi = false;
  /** M'ye basıldığı karede bir kez true olur — sesi aç/kapat. */
  sesToggled = false;

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
      if (ev.code === 'KeyM') this.sesToggled = true;
      if (ev.code === 'Escape') this.cikisIstendi = true;
      // Boşluk ve ok tuşları sayfayı kaydırmasın.
      if (ev.code === 'Space' || ev.code.startsWith('Arrow')) ev.preventDefault();
    });
    target.addEventListener('keyup', (e) => this.down.delete((e as KeyboardEvent).code));
    // Sekme arkaplana geçerse basılı tuşlar takılı kalmasın.
    window.addEventListener('blur', () => { this.down.clear(); this.basili.clear(); });
  }

  // --- dokunmatik pad ---

  /** Parmak düğmenin üstüne indi. */
  komutBas(k: Komut): void { this.basili.add(k); }

  /**
   * Parmak kalktı, kaydı ya da sistem dokunuşu iptal etti.
   *
   * Üçünün de aynı yere bağlanması ŞART: `pointerup` tek başına dinlenirse,
   * parmak düğmeden kayarak çıktığında komut basılı kalır ve makine kendi
   * kendine gaza yapışır.
   */
  komutBirak(k: Komut): void { this.basili.delete(k); }

  /** Bir karelik dokunmatik tetik — klavyedeki tek basışın karşılığı. */
  tetikle(t: Tetik): void {
    if (t === 'sifirla') this.resetRequested = true;
    if (t === 'cikis') this.cikisIstendi = true;
    if (t === 'detay') this.detayToggled = true;
    if (t === 'kanca') this.hookToggled = true;
    if (t === 'ayaklar') this.outriggerToggled = true;
    if (t === 'kat') this.katToggled = true;
  }

  // --- okuma: iki kaynak burada birleşiyor ---

  readDrive(): DriveInput {
    let throttle = 0;
    for (const k of FORWARD) if (this.down.has(k)) throttle += 1;
    for (const k of REVERSE) if (this.down.has(k)) throttle -= 1;
    if (this.basili.has('ileri')) throttle += 1;
    if (this.basili.has('geri')) throttle -= 1;
    return {
      throttle: birlestir(throttle),
      handbrake: this.down.has('Space') || this.basili.has('fren'),
    };
  }

  /**
   * Vinç kumandası — A şeması: her fonksiyon kendi tuşunda.
   * W/S bom kaldır-indir, Shift+W/S teleskop, yukarı/aşağı ok vinç.
   * Shift bomu teleskopa çeviriyor: gerçek kumandada iki ayrı kol olurdu,
   * klavyede aynı elin altında kalması daha rahat. Forkliftte aynı iki eksen
   * çatalı kaldırıyor (`luff`) ve direği yatırıyor (`telescope`).
   */
  readCrane(): CraneAxes {
    const shift = this.down.has('ShiftLeft') || this.down.has('ShiftRight');
    const up = this.down.has('KeyW') ? 1 : 0;
    const dn = this.down.has('KeyS') ? 1 : 0;
    const axis = up - dn;
    // Ok tuşları da Shift ile ikiye ayrılıyor: sade hâli vinç, Shift'li hâli
    // dirsekli bomun hidrolik uzatması. Aynı desen W/S'te zaten var ve
    // dördüncü eksene ayrı bir tuş çifti aramaktan iyi: oyuncunun öğreneceği
    // kural tek — "Shift o kolun ikizini çalıştırır".
    const okAxis = (this.down.has('ArrowUp') ? 1 : 0) - (this.down.has('ArrowDown') ? 1 : 0);

    let luff = shift ? 0 : axis;
    let telescope = shift ? axis : 0;
    let winch = shift ? 0 : okAxis;
    let uzat = shift ? okAxis : 0;

    if (this.basili.has('kaldir') || this.basili.has('bomKaldir')) luff += 1;
    if (this.basili.has('indir') || this.basili.has('bomIndir')) luff -= 1;
    if (this.basili.has('yatGeri') || this.basili.has('teleskopUzat')) telescope += 1;
    if (this.basili.has('yatOn') || this.basili.has('teleskopKis')) telescope -= 1;
    if (this.basili.has('uzamaAc')) uzat += 1;
    if (this.basili.has('uzamaKis')) uzat -= 1;
    if (this.basili.has('kancaYukari')) winch += 1;
    if (this.basili.has('kancaAsagi')) winch -= 1;

    return {
      luff: birlestir(luff), telescope: birlestir(telescope),
      uzat: birlestir(uzat), winch: birlestir(winch),
    };
  }

  consumeReset(): boolean {
    const r = this.resetRequested;
    this.resetRequested = false;
    return r;
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

  /** Ses aç/kapat istendi mi. */
  consumeSesToggle(): boolean {
    const r = this.sesToggled;
    this.sesToggled = false;
    return r;
  }

  /** Araç seçimine dönülsün mü. */
  consumeCikis(): boolean {
    const r = this.cikisIstendi;
    this.cikisIstendi = false;
    return r;
  }

  /**
   * Basılı tuşları ve bekleyen komutları temizler.
   *
   * Kumanda araç değişiminde YENİDEN KURULMUYOR — her kurulum window'a bir
   * dinleyici daha ekler ve eskiler asılı kalırdı. Onun yerine aynı nesne
   * yeni makineye temiz bir durumla giriyor: seçim ekranında basılı kalmış
   * bir tuş ya da yutulmamış bir Esc, yeni bölümün ilk karesine taşmasın.
   */
  sifirla(): void {
    this.down.clear();
    this.basili.clear();
    this.resetRequested = false;
    this.outriggerToggled = false;
    this.hookToggled = false;
    this.katToggled = false;
    this.detayToggled = false;
    this.sesToggled = false;
    this.cikisIstendi = false;
  }
}
