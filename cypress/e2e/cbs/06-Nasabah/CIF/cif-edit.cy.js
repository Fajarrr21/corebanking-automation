// CIF Nasabah — form Edit CIF (/cif/edit/{code}): tampilan + validasi client (TANPA menyimpan).
// Edit sungguhan (hanya pada CIF milik test, nama QA...) ada di cif-edit.irreversible.cy.js.
// TC sumber: docs/test-cases/src/TC_CIF_Edit.json
//
// Halaman edit dibuka untuk CIF pertama di list (GET saja). Write-guard aktif di setiap
// test sehingga form TIDAK PERNAH terkirim ke server.
import LoginPage from '../../../../support/pageobjects/LoginPage';
import CifListPage from '../../../../support/pageobjects/Nasabah/CifListPage';
import CifFormPage from '../../../../support/pageobjects/Nasabah/CifFormPage';

const PHOTO_LABEL = /foto/i;

describe('Nasabah - CIF - Form Edit CIF (/cif/edit/{code})', () => {
  let fx;
  let cif;

  before(() => {
    cy.fixture('nasabah/cif').then((d) => {
      fx = d;
    });
  });

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    LoginPage.loginViaSession();
    cy.guardWrites();
    if (!cif) {
      CifListPage.visitList(fx.paths.list, fx.timeout);
      CifListPage.firstRowData(fx.list.col).then((row) => {
        cif = row;
      });
    }
  });

  describe('Tampilan form edit', () => {
    it('TC-CIF-EDIT-001 | Happy | Form Edit CIF terbuka dan terisi data CIF', () => {
      CifFormPage.visitEdit(cif.code, fx.timeout);
      CifFormPage.assertUrl(`${fx.paths.edit}${cif.code}`).assertBreadcrumb(fx.breadcrumb.edit);
      CifFormPage.elements.input('nik').should('have.value', cif.nik);
      CifFormPage.elements.input('name').should('have.value', cif.name);
      CifFormPage.elements.submitBtn().should('contain.text', fx.form.submitEdit);
      cy.assertNoWritesLeaked();
    });

    it('TC-CIF-EDIT-002 | Positif | Daftar field form Edit sama dengan form Buat CIF', () => {
      CifFormPage.visitCreate(fx.paths.create, fx.timeout);
      CifFormPage.labels().then((createLabels) => {
        CifFormPage.visitEdit(cif.code, fx.timeout);
        CifFormPage.labels().then((editLabels) => {
          // Grup foto memakai label berbeda ("Foto KTP" vs "Ubah Foto KTP") → dibandingkan terpisah.
          const strip = (a) => a.filter((l) => !PHOTO_LABEL.test(l)).sort();
          expect(strip(editLabels), 'field non-foto Edit = Buat').to.deep.eq(strip(createLabels));
          const photos = (a) => a.filter((l) => PHOTO_LABEL.test(l)).length;
          expect(photos(editLabels), 'jumlah field foto Edit = Buat').to.eq(photos(createLabels));
        });
      });
      cy.assertNoWritesLeaked();
    });

    it('TC-CIF-EDIT-003 | Positif | Field wajib (*) form Edit sama dengan form Buat CIF', () => {
      CifFormPage.visitCreate(fx.paths.create, fx.timeout);
      CifFormPage.requiredLabels().then((createReq) => {
        CifFormPage.visitEdit(cif.code, fx.timeout);
        CifFormPage.requiredLabels().then((editReq) => {
          expect([...editReq].sort()).to.deep.eq([...createReq].sort());
        });
      });
      cy.assertNoWritesLeaked();
    });

    it('TC-CIF-EDIT-004 | Positif | Nomor Handphone bertanda wajib (*) di form Edit', () => {
      CifFormPage.visitEdit(cif.code, fx.timeout);
      CifFormPage.requiredLabels().should('include', fx.form.phoneLabel);
      cy.assertNoWritesLeaked();
    });

    it('TC-CIF-EDIT-005 | Positif | Email dapat diubah pada form Edit', () => {
      CifFormPage.visitEdit(cif.code, fx.timeout);
      CifFormPage.elements.input('email').should('not.have.attr', 'readonly');
      cy.assertNoWritesLeaked();
    });
  });

  describe('Validasi & navigasi (tanpa menyimpan)', () => {
    it('TC-CIF-EDIT-006 | Negatif | Nama dikosongkan lalu Simpan diblok tanpa mengirim data', () => {
      CifFormPage.visitEdit(cif.code, fx.timeout);
      CifFormPage.elements.input('name').clear();
      CifFormPage.submit();
      cy.location('pathname').should('eq', `${fx.paths.edit}${cif.code}`);
      CifFormPage.isValid('name').should('eq', false);
      cy.blockedWrites().should('deep.eq', []);
      cy.assertNoWritesLeaked();
    });

    it('TC-CIF-EDIT-007 | Positif | Tombol Batal/Cancel kembali ke list CIF tanpa menyimpan', () => {
      CifFormPage.visitEdit(cif.code, fx.timeout);
      CifFormPage.elements.actionButtons()
        .filter((i, el) => fx.form.cancelLabels.includes(el.innerText.trim()))
        .should('have.length', 1)
        .click();
      cy.location('pathname').should('eq', fx.paths.list);
      cy.assertNoWritesLeaked();
    });

    it('TC-CIF-EDIT-008 | Negatif | Kode CIF tidak terdaftar diarahkan ke list dengan pesan error', () => {
      CifFormPage.open(`${fx.paths.edit}${fx.detail.notFoundCode}`);
      cy.location('pathname').should('eq', fx.paths.list);
      CifFormPage.assertError(fx.detail.notFoundMsg);
      cy.assertNoWritesLeaked();
    });
  });
});
