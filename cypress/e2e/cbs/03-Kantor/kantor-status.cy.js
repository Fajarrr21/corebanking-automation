/// <reference types="cypress" />
// Kantor (/office) — tombol Open/Closed operation TANPA memilih kantor.
// Validasi server (OfficeController@officeStatus) menolak office_id kosong
// SEBELUM menyentuh data. Pengaman berlapis:
//   1. Tidak ada checkbox kantor yang dicentang.
//   2. Intercept khusus: POST /office/status hanya diteruskan bila office_id
//      KOSONG; bila terisi → dibalas 418 (tidak sampai server) dan test gagal.
// Membuka/menutup operasional kantor asli TIDAK diuji (memblokir login user
// kantor tsb di staging bersama).
// TC sheet: docs/test-cases/src/TC_Kantor_Status.json
import KantorPage from '../../../support/pageobjects/Kantor/KantorPage';

describe('Kantor - Ubah status operasional (negatif)', () => {
  let fx;
  let leakedOfficeIds;

  before(() => {
    cy.fixture('kantor/kantor').then((d) => (fx = d));
  });

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    leakedOfficeIds = [];
    KantorPage.openGuarded({ allow: [new RegExp(fx.urls.statusPath)] });
    // Didaftarkan SETELAH guard → dieksekusi lebih dulu (intercept terbaru menang).
    cy.intercept('POST', '**/office/status*', (req) => {
      const officeId = new URLSearchParams(String(req.body || '')).get('office_id') || '';
      if (officeId.trim() !== '') {
        leakedOfficeIds.push(officeId);
        req.reply({ statusCode: 418, body: 'blocked: office_id terisi' });
      }
      // office_id kosong → lanjut ke handler guard (allow) → server.
    }).as('officeStatus');
    KantorPage.assertSuperAdmin(fx.labels.superAdminMenu).waitLoaded();
  });

  afterEach(() => {
    cy.then(() => expect(leakedOfficeIds, 'office_id terkirim (seharusnya kosong)').to.deep.eq([]));
    cy.assertNoWritesLeaked();
  });

  const statusSnapshot = () =>
    KantorPage.showAll(fx.pageLengthAll).rowData().then((rows) =>
      rows.map((c) => `${c[fx.columns.name]}=${c[fx.columns.status]}`));

  const clickWithoutSelection = (btn) => {
    statusSnapshot().then((before) => {
      KantorPage.elements.lengthSelect().select('10');
      KantorPage.elements.table().find('tbody input[type="checkbox"]:checked').should('not.exist');
      KantorPage.elements[btn]().click();
      cy.wait('@officeStatus');
      KantorPage.assertUrl(fx.urls.office).assertError(fx.messages.noOfficeSelected);
      KantorPage.waitLoaded();
      statusSnapshot().then((after) => {
        expect(after, 'status semua kantor sama seperti sebelum klik').to.deep.eq(before);
      });
    });
  };

  it('TC-KTR-STATUS-001 | Negatif | Klik Closed operation tanpa memilih kantor ditolak dan status kantor tidak berubah', () => {
    clickWithoutSelection('closedOperationBtn');
  });

  it('TC-KTR-STATUS-002 | Negatif | Klik Open operation tanpa memilih kantor ditolak dan status kantor tidak berubah', () => {
    clickWithoutSelection('openOperationBtn');
  });
});
