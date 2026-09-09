// components/app-modal.js — Web Component: modal reutilizável (light DOM, sem shadow root)
export class AppModal extends HTMLElement {
  connectedCallback() {
    if (!this.querySelector('.app-modal__backdrop')) {
      const title = this.getAttribute('modal-title') || '';
      // Preserva o conteúdo original (passado pelo chamador) antes de reescrever o innerHTML
      const originalContent = document.createDocumentFragment();
      while (this.firstChild) originalContent.appendChild(this.firstChild);

      this.innerHTML = `
        <div class="app-modal__backdrop" part="backdrop">
          <div class="app-modal__box" role="dialog" aria-modal="true">
            <div class="app-modal__header">
              <h3 class="app-modal__title">${title}</h3>
              <button type="button" class="app-modal__close" aria-label="Close">&times;</button>
            </div>
            <div class="app-modal__body"></div>
          </div>
        </div>
      `;
      this.querySelector('.app-modal__body').appendChild(originalContent);
      this.querySelector('.app-modal__close').addEventListener('click', () => this.close());
      this.querySelector('.app-modal__backdrop').addEventListener('click', (e) => {
        if (e.target.classList.contains('app-modal__backdrop')) this.close();
      });
    }
  }

  open() { this.classList.add('is-open'); }
  close() {
    this.classList.remove('is-open');
    this.dispatchEvent(new CustomEvent('modal-close'));
  }
}
customElements.define('app-modal', AppModal);
