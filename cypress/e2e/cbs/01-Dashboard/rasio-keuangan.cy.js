/// <reference types="cypress" />
// Dashboard - Rasio Keuangan (PRD Notion "Dashboard - Rasio Keuangan").
// Test mengikuti PRD (perilaku benar). Beberapa TC DIHARAPKAN GAGAL selama
// implementasi belum sesuai PRD — lihat kolom Catatan di
// docs/test-cases/src/TC_Dashboard_Rasio.json (kandidat bug).
// Read-only: tombol "Sinkronkan Data" TIDAK diklik; request tulis diblok.
import DashboardPage from '../../../support/pageobjects/Dashboard/DashboardPage';

describe('Dashboard - Rasio Keuangan', () => {
  let fx;
  let rasio;

  before(() => {
    cy.fixture('dashboard/dashboard').then((d) => {
      fx = d;
      rasio = d.rasio;
    });
  });

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    DashboardPage.openGuarded(fx.urls);
  });

  afterEach(() => {
    cy.assertNoWritesLeaked();
  });

  describe('Kartu rasio', () => {
    it('TC-DSB-RASIO-001 | Happy | Bagian Rasio Keuangan menampilkan empat kartu LDR, BOPO, ROA, CAR saat dashboard dibuka', () => {
      DashboardPage.waitCamel(fx.timeouts.ajax);
      rasio.cards.forEach((c) => {
        DashboardPage.assertRatioCardVisible(c.key, fx.timeouts.ajax);
        DashboardPage.elements.ratioCard(c.key).should('contain.text', c.abbr);
      });
    });

    it('TC-DSB-RASIO-002 | Positif | Tiap kartu menampilkan nama rasio beserta kepanjangannya', () => {
      DashboardPage.waitCamel(fx.timeouts.ajax);
      rasio.cards.forEach((c) => {
        DashboardPage.assertRatioCardVisible(c.key, fx.timeouts.ajax);
        DashboardPage.cardText(c.key).then((txt) => {
          expect(txt, `kartu ${c.abbr} memuat singkatan`).to.include(c.abbr);
          expect(txt, `kartu ${c.abbr} memuat kepanjangan`).to.match(new RegExp(c.fullNamePattern, 'i'));
        });
      });
    });

    it('TC-DSB-RASIO-003 | Positif | Nilai rasio dalam persen, maksimal dua angka desimal, sama dengan hasil hitung server', () => {
      DashboardPage.waitCamel(fx.timeouts.ajax).then((body) => {
        expect(body.synced, 'data rasio tersedia (bukan synced:false)').not.to.eq(false);
        rasio.cards.forEach((c) => {
          const d = body[c.jsonKey];
          expect(d, `respon memuat ${c.jsonKey}`).to.be.an('object');
          DashboardPage.elements.ratioValue(c.key).should(($v) => {
            const txt = $v.text().trim();
            expect(txt, `format nilai ${c.abbr}`).to.match(new RegExp(rasio.valuePattern));
            expect(parseFloat(txt), `nilai ${c.abbr} = server`).to.eq(Number(d.value));
          });
        });
      });
    });

    it('TC-DSB-RASIO-004 | Positif | Tiap kartu menampilkan periode yang sedang ditampilkan (default bulan berjalan)', () => {
      DashboardPage.waitCamel(fx.timeouts.ajax);
      const now = new Date();
      const bulan = rasio.bulan[now.getMonth()];
      const tahun = String(now.getFullYear());
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const periodRe = new RegExp(`${bulan}\\s+${tahun}|${mm}[/-]${tahun}|${tahun}[/-]${mm}`, 'i');
      rasio.cards.forEach((c) => {
        DashboardPage.assertRatioCardVisible(c.key, fx.timeouts.ajax);
        DashboardPage.cardText(c.key).then((txt) => {
          expect(txt, `kartu ${c.abbr} memuat periode bulan berjalan`).to.match(periodRe);
        });
      });
    });

    it('TC-DSB-RASIO-005 | Positif | Penanda kondisi memakai label Sehat / Perlu Perhatian / Tidak Sehat (atau kosong bila batas belum diatur)', () => {
      DashboardPage.waitCamel(fx.timeouts.ajax);
      rasio.cards.forEach((c) => {
        DashboardPage.assertRatioCardVisible(c.key, fx.timeouts.ajax);
        DashboardPage.elements.ratioBadge(c.key).invoke('text').then((b) => {
          const label = b.replace(/\s+/g, ' ').trim().toLowerCase();
          expect(['', ...rasio.prdStatusLabels], `penanda kondisi ${c.abbr} = "${label}"`).to.include(label);
        });
      });
    });

    it('TC-DSB-RASIO-006 | Positif | Ikon informasi menampilkan penjelasan singkat dan rumus rasio', () => {
      DashboardPage.waitCamel(fx.timeouts.ajax);
      rasio.cards.forEach((c) => {
        DashboardPage.assertRatioCardVisible(c.key, fx.timeouts.ajax);
        DashboardPage.openRatioInfo(c.key);
        DashboardPage.elements.visiblePopover().should('have.length', 1).within(() => {
          cy.get('.popover-title').should('contain.text', c.popoverTitle);
          cy.get('.popover-content').invoke('text').should((t) => {
            expect(t, `rumus ${c.abbr} memuat operand`).to.include(c.formulaHint);
            expect(t, `rumus ${c.abbr} memuat operator pembagian`).to.match(new RegExp(rasio.formulaOperatorPattern));
          });
        });
        DashboardPage.closeRatioInfo(c.key);
        cy.get('.popover:visible').should('not.exist');
      });
    });

    it('TC-DSB-RASIO-007 | Positif | Di bawah nilai tampil selisih terhadap periode sebelumnya beserta arah naik/turun', () => {
      DashboardPage.waitCamel(fx.timeouts.ajax);
      rasio.cards.forEach((c) => {
        DashboardPage.assertRatioCardVisible(c.key, fx.timeouts.ajax);
        DashboardPage.elements.ratioCard(c.key).should(($card) => {
          const hasIcon = $card.find(rasio.deltaSelector).length > 0;
          const hasText = new RegExp(rasio.deltaTextPattern, 'i').test($card[0].innerText);
          expect(hasIcon || hasText, `kartu ${c.abbr} menampilkan selisih & arah vs periode sebelumnya`).to.eq(true);
        });
      });
    });
  });

  describe('Filter & perhitungan ulang', () => {
    it('TC-DSB-RASIO-008 | Positif | Dashboard menyediakan filter Cabang dan Periode yang berlaku untuk Rasio Keuangan', () => {
      DashboardPage.elements.pageContent().should(($pc) => {
        expect($pc.find(rasio.branchFilterSelector).length, 'filter Cabang ada di dashboard').to.be.greaterThan(0);
        expect($pc.find(rasio.periodFilterSelector).length, 'filter Periode ada di dashboard').to.be.greaterThan(0);
      });
    });

    it('TC-DSB-RASIO-009 | Edge | Rasio dihitung ulang setiap dashboard dibuka tanpa perlu klik "Sinkronkan Data"', () => {
      DashboardPage.waitCamel(fx.timeouts.ajax).then((body) => {
        expect(body.synced, 'camel-data tidak boleh {synced:false} (harus dihitung saat dibuka)').not.to.eq(false);
      });
      rasio.cards.forEach((c) => {
        DashboardPage.elements.ratioSkeleton(c.key).should('not.contain.text', fx.labels.notSyncedMessage);
      });
    });
  });
});
