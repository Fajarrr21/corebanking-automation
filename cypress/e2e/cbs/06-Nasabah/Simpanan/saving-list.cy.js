// Simpanan Nasabah — list /saving (read-only, kecuali TC Export yang mengantrikan file
// unduhan milik user sendiri lewat GET /export/saving).
// TC sumber: docs/test-cases/src/TC_Simpanan_List.json
import LoginPage from '../../../../support/pageobjects/LoginPage';
import SavingListPage, { parseIdr } from '../../../../support/pageobjects/Nasabah/SavingListPage';

const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();

describe('Nasabah - Simpanan - List Simpanan (/saving)', () => {
  let fx;

  before(() => {
    cy.fixture('nasabah/saving').then((d) => {
      fx = d;
    });
  });

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    LoginPage.loginViaSession();
    cy.guardWrites();
  });

  afterEach(() => {
    cy.assertNoWritesLeaked();
  });

  const balances = () => SavingListPage.columnTexts(fx.list.col.balance).then((t) => t.map(parseIdr));

  describe('Tampilan halaman', () => {
    it('TC-SMP-LIST-001 | Happy | Halaman list simpanan terbuka dan tabel termuat dari /saving/data', () => {
      SavingListPage.visitList(fx.paths.list, fx.timeout);
      SavingListPage.assertUrl(fx.paths.list).assertNotRedirectedToLogin().assertBreadcrumb(fx.breadcrumb.list);
      cy.get('@savingData').its('response.statusCode').should('eq', 200);
    });

    it('TC-SMP-LIST-002 | Positif | Kartu ringkasan saldo tampil', () => {
      SavingListPage.visitList(fx.paths.list, fx.timeout);
      cy.get('.page-content').should(($c) => {
        const text = norm($c.text());
        fx.list.summaryCards.forEach((l) => expect(text, `kartu "${l}"`).to.include(l));
      });
      SavingListPage.elements.countAll().should('be.visible');
      SavingListPage.elements.sumAll().should('be.visible');
    });

    it('TC-SMP-LIST-003 | Positif | Kolom list simpanan sesuai PRD', () => {
      SavingListPage.visitList(fx.paths.list, fx.timeout);
      SavingListPage.tableHeaders(SavingListPage.table).should(($th) => {
        const actual = Cypress.$.makeArray($th).map((th) => norm(th.innerText));
        fx.list.prdHeaders.forEach((h) => expect(actual, `kolom PRD "${h}"`).to.include(h));
      });
    });

    it('TC-SMP-LIST-004 | Positif | Setiap baris punya aksi Lihat menuju detail simpanan', () => {
      SavingListPage.visitList(fx.paths.list, fx.timeout);
      SavingListPage.dataRows(SavingListPage.table).should('have.length.greaterThan', 0);
      cy.get(`${SavingListPage.table} tbody tr`).should(($rows) => {
        Cypress.$.makeArray($rows)
          .filter((r) => !Cypress.$(r).find('td.dataTables_empty').length)
          .forEach((r) => {
            const $a = Cypress.$(r).find('td').eq(0).find('a');
            expect(norm($a.text())).to.eq(fx.list.viewLabel);
            expect($a.attr('href')).to.match(/\/saving\/[^/]+$/);
          });
      });
    });

    it('TC-SMP-LIST-005 | Positif | Status rekening hanya Aktif atau Tidak Aktif', () => {
      SavingListPage.visitList(fx.paths.list, fx.timeout);
      SavingListPage.assertEveryRowColumn(
        fx.list.col.status,
        (t) => fx.list.prdStatusValues.includes(t),
        `Status ∈ ${fx.list.prdStatusValues.join('/')}`,
        SavingListPage.table,
      );
    });

    it('TC-SMP-LIST-006 | Positif | List diurutkan dari rekening terbaru di atas', () => {
      SavingListPage.visitList(fx.paths.list, fx.timeout);
      SavingListPage.columnTexts(fx.list.col.id).then((ids) => {
        const n = ids.map(Number);
        expect(n.length).to.be.greaterThan(1);
        expect(n, 'ID menurun (terbaru di atas)').to.deep.eq([...n].sort((a, b) => b - a));
      });
    });
  });

  describe('Filter saldo', () => {
    it('TC-SMP-LIST-007 | Positif | Filter saldo minimum & maksimum menampilkan rekening dalam rentang (inklusif)', () => {
      SavingListPage.visitList(fx.paths.list, fx.timeout);
      SavingListPage.applyBalanceRange(fx.balanceFilter.min, fx.balanceFilter.max, fx.timeout);
      cy.get('@savingRange').its('request.url')
        .should('include', `balance_min=${fx.balanceFilter.min}`)
        .and('include', `balance_max=${fx.balanceFilter.max}`);
      balances().then((b) => {
        b.forEach((v) => expect(v, `saldo ${v} dalam rentang`).to.be.within(Number(fx.balanceFilter.min), Number(fx.balanceFilter.max)));
      });
    });

    it('TC-SMP-LIST-008 | Positif | Hanya Saldo Minimum diisi menampilkan saldo >= minimum', () => {
      SavingListPage.visitList(fx.paths.list, fx.timeout);
      SavingListPage.applyBalanceRange(fx.balanceFilter.min, undefined, fx.timeout);
      balances().then((b) => b.forEach((v) => expect(v).to.be.at.least(Number(fx.balanceFilter.min))));
    });

    it('TC-SMP-LIST-009 | Edge | Saldo Maksimum 0 menampilkan rekening bersaldo kosong', () => {
      SavingListPage.visitList(fx.paths.list, fx.timeout);
      SavingListPage.applyBalanceRange(undefined, '0', fx.timeout);
      cy.get('@savingRange').its('request.url').should('include', 'balance_max=0');
      balances().then((b) => b.forEach((v) => expect(v, 'saldo').to.eq(0)));
    });

    it('TC-SMP-LIST-010 | Positif | Isian saldo hanya angka dan diberi pemisah ribuan saat diketik', () => {
      SavingListPage.visitList(fx.paths.list, fx.timeout);
      SavingListPage.elements.balanceMin().type(fx.balanceFilter.typedMillion, { delay: 0 })
        .should('have.value', fx.balanceFilter.typedMillionFormatted);
      SavingListPage.elements.balanceMax().type(fx.balanceFilter.typedWithLetters, { delay: 0 })
        .should('have.value', fx.balanceFilter.typedWithLettersFormatted);
    });

    it('TC-SMP-LIST-011 | Negatif | Saldo minimum lebih besar dari maksimum menampilkan error dan tidak menyaring', () => {
      SavingListPage.visitList(fx.paths.list, fx.timeout);
      SavingListPage.applyBalanceRange(fx.balanceFilter.invalidMin, undefined, fx.timeout);
      SavingListPage.interceptData('afterInvalid');
      SavingListPage.typeBalance('max', fx.balanceFilter.invalidMax);
      SavingListPage.elements.rangeError().should('be.visible').and('have.text', fx.balanceFilter.rangeError);
      // Tidak ada reload tabel setelah isian tidak valid.
      cy.get('@afterInvalid.all').should('have.length', 0);
    });

    it('TC-SMP-LIST-012 | Positif | Ringkasan menyesuaikan hasil filter saldo', () => {
      SavingListPage.visitList(fx.paths.list, fx.timeout);
      SavingListPage.applyBalanceRange(undefined, '0', fx.timeout);
      cy.get('@savingRange').its('response.body.recordsFiltered').then((filtered) => {
        SavingListPage.elements.countAll().invoke('text').then((t) => {
          expect(parseIdr(t), 'JUMLAH NASABAH = jumlah rekening hasil filter').to.eq(Number(filtered));
        });
        SavingListPage.elements.sumAll().invoke('text').then((t) => {
          expect(parseIdr(t), 'Saldo Total hasil filter saldo maks 0').to.eq(0);
        });
      });
    });
  });

  describe('Filter lain & pencarian', () => {
    it('TC-SMP-LIST-013 | Positif | Pencarian nama nasabah menampilkan rekening yang sesuai', () => {
      SavingListPage.visitList(fx.paths.list, fx.timeout);
      SavingListPage.firstRowData(fx.list.col).then((row) => {
        SavingListPage.search(row.name, fx.timeout);
        SavingListPage.columnTexts(fx.list.col.accountNumber).should('include', row.accountNumber);
      });
    });

    it('TC-SMP-LIST-014 | Positif | Pencarian nomor rekening menampilkan rekening yang sesuai', () => {
      SavingListPage.visitList(fx.paths.list, fx.timeout);
      SavingListPage.firstRowData(fx.list.col).then((row) => {
        expect(row.accountNumber, 'precondition: rekening pertama punya nomor rekening').not.to.eq('');
        SavingListPage.search(row.accountNumber, fx.timeout);
        SavingListPage.columnTexts(fx.list.col.accountNumber).should('deep.eq', [row.accountNumber]);
      });
    });

    it('TC-SMP-LIST-015 | Negatif | Hasil pencarian kosong menampilkan halaman kosong', () => {
      SavingListPage.visitList(fx.paths.list, fx.timeout);
      SavingListPage.search(fx.list.notFoundKeyword, fx.timeout);
      SavingListPage.emptyState(SavingListPage.table).should('be.visible');
    });

    it('TC-SMP-LIST-016 | Positif | Hasil kosong menyediakan tombol Reset Filter yang mengosongkan filter', () => {
      SavingListPage.visitList(fx.paths.list, fx.timeout);
      SavingListPage.search(fx.list.notFoundKeyword, fx.timeout);
      cy.get('.page-content').contains('a, button', fx.list.resetFilterLabel).should('be.visible').click();
      SavingListPage.tableSearch(SavingListPage.table).should('have.value', '');
      SavingListPage.dataRows(SavingListPage.table).should('have.length.greaterThan', 0);
    });

    it('TC-SMP-LIST-017 | Positif | Tersedia filter Rentang Tanggal Buka Rekening', () => {
      SavingListPage.visitList(fx.paths.list, fx.timeout);
      SavingListPage.elements.toolbar().should(($t) => {
        const text = `${$t.text()} ${Cypress.$.makeArray($t.find('input')).map((i) => i.placeholder).join(' ')}`;
        const found = fx.list.openDateFilterHints.some((h) => text.includes(h));
        expect(found, 'filter Tanggal Buka Rekening ada di toolbar').to.eq(true);
      });
    });

    it('TC-SMP-LIST-018 | Positif | Filter Status Aktif hanya menampilkan rekening Aktif', () => {
      SavingListPage.visitList(fx.paths.list, fx.timeout);
      SavingListPage.applySelectFilter('#filter_status', fx.list.statusActiveValue, fx.timeout);
      SavingListPage.assertEveryRowColumn(fx.list.col.status, (t) => t === fx.list.statusActiveLabel, 'Status', SavingListPage.table);
    });

    it('TC-SMP-LIST-019 | Positif | Filter Produk Simpanan hanya menampilkan produk terpilih', () => {
      SavingListPage.visitList(fx.paths.list, fx.timeout);
      SavingListPage.firstFilterOption('#filter_product').then((product) => {
        SavingListPage.applySelectFilter('#filter_product', product, fx.timeout);
        SavingListPage.assertEveryRowColumn(fx.list.col.product, (t) => t === product, 'Produk', SavingListPage.table);
      });
    });

    it('TC-SMP-LIST-020 | Positif | Filter Cabang (user pusat) hanya menampilkan rekening cabang terpilih', () => {
      SavingListPage.visitList(fx.paths.list, fx.timeout);
      SavingListPage.isUserPusat().then((pusat) => {
        if (!pusat) throw new Error('Precondition tidak terpenuhi: filter cabang hanya untuk user pusat (office_id 0). Butuh akun pusat.');
      });
      SavingListPage.firstRowData(fx.list.col).then((row) => {
        SavingListPage.applySelectFilter('#filter_office', row.office, fx.timeout);
        SavingListPage.assertEveryRowColumn(fx.list.col.office, (t) => t.includes(row.office), 'Kantor Cabang', SavingListPage.table);
      });
    });
  });

  describe('Export', () => {
    it('TC-SMP-LIST-021 | Positif | Export Excel memproses list sesuai filter aktif', () => {
      SavingListPage.visitList(fx.paths.list, fx.timeout);
      SavingListPage.applyBalanceRange(fx.balanceFilter.min, fx.balanceFilter.max, fx.timeout);
      cy.intercept({ method: 'GET', pathname: fx.paths.export }).as('exportSaving');
      SavingListPage.elements.exportBtn(fx.list.exportLabel).click();
      cy.wait('@exportSaving', { timeout: fx.timeout }).then(({ request }) => {
        expect(request.url).to.include(`balance_min=${fx.balanceFilter.min}`);
        expect(request.url).to.include(`balance_max=${fx.balanceFilter.max}`);
      });
      cy.location('pathname', { timeout: fx.timeout }).should('eq', fx.paths.list);
      SavingListPage.assertSuccess(fx.list.exportQueuedMsg);
    });
  });
});
