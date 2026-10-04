// ImportPage — halaman Upload Excel: /import/cif, /import/saving, /import/loan, /import/neraca.
// Keempat view (resources/views/import/*.blade.php) identik strukturnya:
//   note .note-info berisi link template  -> asset('/assets/excel/<nama>.xlsx')
//   <form id="form_sample_3" method="POST" enctype="multipart/form-data" action="route(import.importX)">
//     <input type="file" name="file" id="CSVCif|CSVTabungan">  (TANPA required/accept)
//     <button type="submit" class="btn blue-steel">Proses</button>
// Validasi file sepenuhnya di SERVER (ImportController@importX): ekstensi bukan
// xlsx/xls/csv -> errorRedirect(import.X, 'Import gagal! Silahkan gunakan template yang disediakan.')
// sebelum Excel::import (tidak ada data tercipta). Tanpa file -> 'Import gagal! File kosong.'
import RoleGuardPage from '../Transaksi/RoleGuardPage';

class ImportPage extends RoleGuardPage {
  elements = {
    templateLink: () => cy.get('.note.note-info a'),
    caption: () => cy.get('.portlet-title .caption-subject'),
    form: () => cy.get('form#form_sample_3'),
    fileInput: () => cy.get('form#form_sample_3 input[type="file"][name="file"]'),
    uploadLabel: () => cy.get('form#form_sample_3 label.control-label'),
    submit: () => cy.get('form#form_sample_3 button[type="submit"]'),
  };

  /** Pilih file isi bebas (Buffer) di input upload. */
  attach({ name, content, mime }) {
    this.elements.fileInput().selectFile(
      { contents: Cypress.Buffer.from(content), fileName: name, mimeType: mime },
      { force: true },
    );
    return this;
  }

  submit() {
    this.elements.submit().click();
    return this;
  }

  // ------------------------------------------------------------------
  // Skenario bersama 4 halaman import (dipanggil dari spec per halaman).
  // pg = fixture import.pages.<key>, fx = fixture import (root).
  // ------------------------------------------------------------------

  /** Halaman tampil: breadcrumb, judul tab, caption. Guard tulis aktif. */
  scenarioPage(pg, fx) {
    cy.guardWrites();
    this.openGuarded(pg.path, fx.roleHint);
    this.assertBreadcrumb(pg.breadcrumb).assertDocumentTitle(pg.title);
    this.elements.caption().should('contain.text', pg.caption);
    return this;
  }

  /** Link template menunjuk file yang benar & bisa diunduh (200). */
  scenarioTemplate(pg, fx) {
    cy.guardWrites();
    this.openGuarded(pg.path, fx.roleHint);
    this.elements.templateLink().invoke('prop', 'href').then((href) => {
      expect(decodeURI(href)).to.include(pg.template);
      this.assertDownloadable(href);
    });
    return this;
  }

  /** Struktur form upload. */
  scenarioForm(pg, fx) {
    cy.guardWrites();
    this.openGuarded(pg.path, fx.roleHint);
    this.elements.form().should('have.attr', 'method', 'POST').and('have.attr', 'enctype', 'multipart/form-data');
    this.elements.form().invoke('attr', 'action').then((a) => expect(new URL(a).pathname).to.eq(pg.action));
    this.elements.fileInput().should('have.attr', 'id', pg.fileInputId);
    this.elements.uploadLabel().should('contain.text', fx.uploadLabel);
    this.elements.submit().should('contain.text', fx.submitLabel);
    return this;
  }

  /**
   * Validasi server file salah tipe. POST ke endpoint import DIIZINKAN guard karena
   * controller menolak ekstensi sebelum Excel::import (tidak ada data tercipta).
   */
  scenarioWrongType(pg, fx) {
    cy.guardWrites({ allow: [new RegExp(`^${pg.action}$`)] });
    this.openGuarded(pg.path, fx.roleHint);
    this.attach(fx.wrongFile).submit();
    cy.location('pathname').should('eq', pg.path);
    this.assertError(fx.errors.wrongType);
    return this;
  }

  /** Validasi server tanpa file (hasFile=false) -> 'Import gagal! File kosong.' */
  scenarioEmpty(pg, fx) {
    cy.guardWrites({ allow: [new RegExp(`^${pg.action}$`)] });
    this.openGuarded(pg.path, fx.roleHint);
    this.submit();
    cy.location('pathname').should('eq', pg.path);
    this.assertError(fx.errors.empty);
    return this;
  }
}

export default new ImportPage();
