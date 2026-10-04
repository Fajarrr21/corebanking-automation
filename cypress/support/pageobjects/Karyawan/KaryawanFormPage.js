// KaryawanFormPage — form Tambah (/user/create) & Edit (/user/{id}) karyawan.
//
// Source develop: UserController@create/createPost (CreateUserRequest),
// @edit/editPost (EditUserRequest). createPost mengirim email kredensial
// (VerificationNotification) → membuat user = aksi tak bisa dibatalkan
// (spec terpisah *.irreversible.cy.js, flag allowUserCreate).
//
// Create: form#form_sample_3 (validasi HTML5 `required` saja, tanpa
//   jquery-validate). Edit: form[action*="/user/{id}"] tanpa id.
// Field: name, email (readonly di edit), office_id (select2me), phone,
//   roles[] (checkbox), status (edit saja).

import BasePage from '../BasePage';
import LoginPage from '../LoginPage';

class KaryawanFormPage extends BasePage {
  elements = {
    form: () => cy.get('.page-content form.form-horizontal').first(),
    nameInput: () => cy.get('.page-content input[name="name"]'),
    emailInput: () => cy.get('.page-content input[name="email"]'),
    officeSelect: () => cy.get('.page-content select[name="office_id"]'),
    phoneInput: () => cy.get('.page-content input[name="phone"]'),
    roleCheckboxes: () => cy.get('.page-content input[name="roles[]"]'),
    roleCheckbox: (value) => cy.get(`.page-content input[name="roles[]"][value="${value}"]`),
    statusSelect: () => cy.get('.page-content select[name="status"]'),
    submitBtn: () => cy.get('.page-content .form-actions button[type="submit"]'),
    cancelBtn: () => cy.get('.page-content .form-actions button.default'),
    note: () => cy.get('.page-content .note.note-info'),
    formLabels: () => cy.get('.page-content form .form-group > label.control-label'),
  };

  openGuarded(path, { allow = [] } = {}) {
    LoginPage.loginViaSession();
    cy.guardWrites({ allow });
    cy.visit(path);
    return this;
  }

  /** Tanpa guard — HANYA untuk spec irreversible yang di-gate flag. */
  openUnguarded(path) {
    LoginPage.loginViaSession();
    cy.visit(path);
    return this;
  }

  fill({ name, email, phone, office, roles = [] }) {
    if (name !== undefined) this.elements.nameInput().clear().type(name, { delay: 0 });
    if (email !== undefined) this.elements.emailInput().clear().type(email, { delay: 0 });
    if (phone !== undefined) this.elements.phoneInput().clear().type(phone, { delay: 0 });
    if (office !== undefined) this.selectNative('.page-content select[name="office_id"]', office);
    roles.forEach((r) => this.elements.roleCheckbox(r).check({ force: true }));
    return this;
  }

  /**
   * Pilih kantor nyata pertama (opsi ke-2, setelah "Tanpa Kantor").
   * Catatan: user "Tanpa Kantor" (office_id 0) tidak bisa di-edit karena
   * EditUserRequest office_id `exists:offices,id` menolak nilai 0.
   */
  selectFirstRealOffice() {
    this.elements.officeSelect().find('option').eq(1).then(($o) => {
      expect($o.val(), 'precondition: ada minimal 1 kantor').to.match(/^\d+$/);
      this.selectNative('.page-content select[name="office_id"]', $o.val());
    });
    return this;
  }

  submit() {
    this.elements.submitBtn().click();
    return this;
  }

  /** Yield daftar value roles[] yang tercentang. */
  checkedRoles() {
    return this.elements.roleCheckboxes().then(($cb) => {
      const v = Cypress.$.makeArray($cb).filter((c) => c.checked).map((c) => c.value);
      return cy.then(() => v);
    });
  }
}

export default new KaryawanFormPage();
