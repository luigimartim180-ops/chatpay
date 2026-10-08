/**
 * XREAL Bridge — smart glasses via WebSocket (Fase 4 — scaffold)
 * Portal: https://developer.xreal.com (SDK free)
 * Env: XREAL_GLASSES_ADDRESS=ws://host:8080
 *
 * Sem hardware: usar simulator/mock para testes.
 */

export class XREALBridge {
  constructor(glassesAddress = process.env.XREAL_GLASSES_ADDRESS || 'ws://localhost:8080') {
    this.address = glassesAddress;
    this.ws = null;
    this.isConnected = false;
    this._inputHandlers = [];
  }

  async connect() {
    // Scaffold: não abre socket real até Fase 4 + dependência ws instalada
    throw new Error('XREAL connect: ativar na Fase 4 (npm i ws + hardware/simulator)');
  }

  showNotification({ title, message, duration = 5000 }) {
    this._send({ type: 'notification', payload: { title, message, duration } });
  }

  showProductCard({ product, buyLink }) {
    this._send({ type: 'product_card', payload: { ...product, buy_link: buyLink } });
  }

  showNavigationMenu({ options }) {
    this._send({ type: 'navigation_menu', payload: { options } });
  }

  onUserInput(cb) {
    this._inputHandlers.push(cb);
  }

  _send(obj) {
    if (!this.isConnected || !this.ws) throw new Error('XREAL not connected');
    this.ws.send(JSON.stringify(obj));
  }

  disconnect() {
    if (this.ws) this.ws.close();
    this.isConnected = false;
  }
}

export default XREALBridge;
