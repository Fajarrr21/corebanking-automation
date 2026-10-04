// CifFormPage — form Buat CIF (/cif/create) & Edit CIF (/cif/edit/{code}).
//
// Sumber: resources/views/cif/create.blade.php, cif/edit.blade.php,
// App\Http\Requests\CreateCifRequest / UpdateCifRequest, CifController.
// - Create: <form id="form_sample_3" action="/cif/create" method="POST" enctype=multipart>,
//   submit "Proses". TIDAK ada tombol Batal.
// - Edit  : <form action="/cif/edit/{code}" method="POST">, submit "Simpan" + <button
//   type="button" class="btn default">Cancel</button> (tanpa handler).
// - Field by name: nik (#nik, oninput hanya angka, maxlength 16), name, place_of_birth,
//   date_of_birth (readonly + datepicker dd-mm-yyyy), gender, address, province (#province),
//   city (#city), district (#district), village (#village), occupation, annual_income,
//   marital_status (#marital_status), husband_or_wifes_*, mother_name, religion, email
//   (type=email; readonly di Edit), security_answer, phone, npwp, image_ktp, image_npwp.
// - Wilayah berantai via axios GET /data/provinces, /data/cities/{id},
//   /data/districts/{id}, /data/villages/{id}.
// - Create: blur #nik → GET /cif/check-nik?nik= → teks di #nik_feedback.
// - Field wajib diberi `required` HTML5 → submit form kosong diblok browser (tanpa POST).
// - Error validasi server: <span class="help-block" style="color: red;"> per field.

import BasePage from '../BasePage';

const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const labelOf = (el) => norm(Cypress.$(el).find('label').first().clone().children('.required').remove().end().text());

class CifFormPage extends BasePage {
  formSel = '.portlet-form form[method="POST"]';

  elements = {
    form: () => cy.get(this.formSel),
    input: (name) => cy.get(`${this.formSel} [name="${name}"]`),
    nik: () => cy.get(`${this.formSel} input[name="nik"]`),
    nikFeedback: () => cy.get('#nik_feedback'),
    formGroups: () => cy.get(`${this.formSel} .form-body .form-group`),
    groupByLabel: (label) => cy.get(`${this.formSel} .form-body .form-group`).filter((i, el) => labelOf(el) === label),
    submitBtn: () => cy.get(`${this.formSel} .form-actions button[type="submit"]`),
    actionButtons: () => cy.get(`${this.formSel} .form-actions`).find('button, a'),
    fieldError: (name) =>
      cy.get(`${this.formSel} [name="${name}"]`).closest('.form-group').find('.help-block').filter((i, el) => /red/i.test(el.getAttribute('style') || '')),
  };

  interceptRegion() {
    cy.intercept({ method: 'GET', pathname: '/data/provinces' }).as('provinces');
    cy.intercept({ method: 'GET', pathname: /^\/data\/cities\/\d+$/ }).as('cities');
    cy.intercept({ method: 'GET', pathname: /^\/data\/districts\/\d+$/ }).as('districts');
    cy.intercept({ method: 'GET', pathname: /^\/data\/villages\/\d+$/ }).as('villages');
    return this;
  }

  visitCreate(path = '/cif/create', timeout = 30000) {
    this.interceptRegion();
    this.open(path);
    cy.wait('@provinces', { timeout });
    return this;
  }

  visitEdit(code, timeout = 30000) {
    this.interceptRegion();
    this.open(`/cif/edit/${code}`);
    cy.wait('@provinces', { timeout });
    return this;
  }

  /** NIK 16 digit acak yang diawali prefix (default "99") — untuk data uji. */
  static generateNik(prefix = '99') {
    const body = `${Date.now()}${Math.floor(Math.random() * 10)}`;
    return `${prefix}${body}`.slice(0, 16).padEnd(16, '0');
  }

  generateNik(prefix) {
    return CifFormPage.generateNik(prefix);
  }

  /** Label seluruh form-group (tanpa tanda *), urutan DOM. */
  labels() {
    return this.elements.formGroups().then(($g) => Cypress.$.makeArray($g).map(labelOf).filter(Boolean));
  }

  /** Label yang ditandai `span.required` (*). */
  requiredLabels() {
    return this.elements.formGroups().then(($g) =>
      Cypress.$.makeArray($g)
        .filter((el) => Cypress.$(el).find('label').first().find('.required').length > 0)
        .map(labelOf),
    );
  }

  typeField(name, value) {
    this.elements.input(name).clear();
    if (value !== '' && value !== undefined && value !== null) {
      this.elements.input(name).type(String(value), { delay: 0 });
    }
    return this;
  }

  setReadonlyValue(name, value) {
    this.elements.input(name).invoke('val', value).trigger('change');
    return this;
  }

  /** Pilih opsi pertama non-placeholder dari select setelah alias ajax selesai. */
  selectFirstOptionAfter(selector, alias, timeout = 30000) {
    cy.wait(alias, { timeout });
    cy.get(selector).find('option:not([disabled])').should('have.length.greaterThan', 0);
    cy.get(selector).find('option:not([disabled])').first().then(($o) => {
      cy.get(selector).select($o.val(), { force: true });
    });
    return this;
  }

  /** Pilih provinsi (teks) → kota/kec/desa pertama secara berantai. */
  fillRegion(provinceText, timeout = 30000) {
    cy.get('#province').select(provinceText, { force: true });
    this.selectFirstOptionAfter('#city', '@cities', timeout);
    this.selectFirstOptionAfter('#district', '@districts', timeout);
    this.selectFirstOptionAfter('#village', '@villages', timeout);
    return this;
  }

  /**
   * Isi seluruh field wajib (create). `d` = { nik, name, placeOfBirth, dateOfBirth,
   * gender, address, provinceText, occupation, annualIncome, marital, motherName,
   * phone?, email? }.
   */
  fillValid(d) {
    this.typeField('nik', d.nik);
    this.typeField('name', d.name);
    this.typeField('place_of_birth', d.placeOfBirth);
    this.setReadonlyValue('date_of_birth', d.dateOfBirth);
    this.selectNative(`${this.formSel} select[name="gender"]`, d.gender);
    this.typeField('address', d.address);
    this.fillRegion(d.provinceText);
    this.selectNative(`${this.formSel} select[name="occupation"]`, d.occupation);
    this.selectNative(`${this.formSel} select[name="annual_income"]`, d.annualIncome);
    if (d.marital) this.selectNative('#marital_status', d.marital);
    this.typeField('mother_name', d.motherName);
    if (d.phone !== undefined) this.typeField('phone', d.phone);
    if (d.email !== undefined) this.typeField('email', d.email);
    return this;
  }

  submit() {
    this.elements.submitBtn().click();
    return this;
  }

  /** Validitas HTML5 field (true = valid). */
  isValid(name) {
    return this.elements.input(name).then(($el) => $el[0].checkValidity());
  }

  /** Validitas HTML5 seluruh form. */
  formIsValid() {
    return this.elements.form().then(($f) => $f[0].checkValidity());
  }
}

export default new CifFormPage();
