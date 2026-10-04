// FinancialReportPage — /financial-report "Publikasi Laporan Keuangan" (menu Website LKM).
// Controller: FinancialReportController (role super-admin/supervisor via checkRole).
// View: resources/views/financial_report/index.blade.php — tabel BUKAN DataTables
// (render server Blade, @forelse; kosong -> <td colspan=5>Belum ada laporan.</td>).
// Aksi per baris: Unduh (GET /lkm/laporan/{id}/unduh, hanya published), toggle publish
// (POST /financial-report/{id}/publish), Hapus (POST /financial-report/{id}/delete + confirm()).
// Halaman publik "/" (LandingController@index) menampilkan laporan is_published=true.
import RoleGuardPage from '../Transaksi/RoleGuardPage';

class FinancialReportPage extends RoleGuardPage {
  elements = {
    note: () => cy.get('.note.note-info'),
    landingLink: () => cy.get('.note.note-info a'),
    form: () => cy.get('form[action$="/financial-report"]'),
    title: () => cy.get('form[action$="/financial-report"] input[name="title"]'),
    year: () => cy.get('form[action$="/financial-report"] input[name="year"]'),
    period: () => cy.get('form[action$="/financial-report"] input[name="period"]'),
    file: () => cy.get('form[action$="/financial-report"] input[name="file"]'),
    publish: () => cy.get('form[action$="/financial-report"] input[name="is_published"]'),
    submit: () => cy.get('form[action$="/financial-report"] button[type="submit"]'),
    table: () => cy.get('.table-responsive table'),
    rows: () => cy.get('.table-responsive table tbody tr'),
  };

  /** Baris yang kolom Judul (index 1) persis = title. Column-scoped. */
  rowByTitle(title) {
    return this.elements.rows().filter((_, tr) => Cypress.$(tr).find('td').eq(1).text().trim() === title);
  }

  /** Semua baris yang kolom Judul diawali "QA" (untuk cleanup). */
  qaRows() {
    return cy.get('.table-responsive table tbody tr').then(($tr) =>
      Cypress.$.makeArray($tr).filter((tr) => Cypress.$(tr).find('td').eq(1).text().trim().startsWith('QA')),
    );
  }

  /** Status (Publik/Draf) baris berjudul title. */
  statusOf(title) {
    return this.rowByTitle(title).find('td').eq(3).invoke('text').then((t) => cy.then(() => t.trim()));
  }

  /** Daftar judul laporan di halaman publik. */
  landingTitles(landing) {
    cy.visit('/', { failOnStatusCode: false });
    return cy.get('body').then(($b) => {
      const titles = Cypress.$.makeArray($b.find(`${landing.rowSelector} ${landing.titleSelector}`)).map((el) =>
        el.textContent.replace(/\s+/g, ' ').trim(),
      );
      return cy.then(() => titles);
    });
  }

  /** Upload laporan QA (submit sungguhan). */
  upload({ title, year, period, pdfFixture, publish }) {
    this.elements.title().clear().type(title);
    this.elements.year().clear().type(year);
    if (period) this.elements.period().clear().type(period);
    this.elements.file().selectFile(`cypress/fixtures/${pdfFixture}`);
    if (publish) this.elements.publish().check({ force: true });
    else this.elements.publish().uncheck({ force: true });
    this.elements.submit().click();
    return this;
  }

  togglePublish(title) {
    this.rowByTitle(title).find('form[action*="/publish"] button[type="submit"]').click();
    return this;
  }

  deleteRow(title) {
    cy.on('window:confirm', () => true);
    this.rowByTitle(title).find('form[action*="/delete"] button[type="submit"]').click();
    return this;
  }
}

export default new FinancialReportPage();
