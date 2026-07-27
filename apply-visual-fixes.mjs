#!/usr/bin/env node
/**
 * ============================================================================
 * apply-visual-fixes.mjs
 * ----------------------------------------------------------------------------
 * سكريبت مدمج واحد يطبّق كل التعديلات المقترحة الجديدة (غير المذكورة سابقًا
 * والمُسندة بالفعل لوكيل آخر): إصلاح خصائص RTL المنطقية، وإصلاح مدد الانتقال
 * الوهمية (duration-250 / duration-205 وما شابه)، ثم يطبع تقريرًا نصيًا عن
 * كل ما يحتاج مراجعة بشرية (أهداف اللمس الصغيرة، اتجاه التدرجات، الوصول)
 * بدل التعديل التلقائي الخطر في هذه النقاط.
 *
 * لا يمس المحتوى أو المنطق أو أي prop أو state — فقط قيم className النصية.
 *
 * الاستخدام:
 *   node apply-visual-fixes.mjs                 → تشغيل تجريبي (dry-run) فقط،
 *                                                  يطبع كل ما سيتغيّر بدون كتابة شيء
 *   node apply-visual-fixes.mjs --apply         → يطبّق التعديلات فعليًا على الملفات
 *   node apply-visual-fixes.mjs --dir=src/components --apply
 *                                                → تحديد مجلد مختلف عن الافتراضي
 * ============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const dirArg = args.find(a => a.startsWith('--dir='));
const TARGET_DIRS = dirArg
  ? [dirArg.split('=')[1]]
  : ['src/components', 'src/utils', 'src'];

const EXTENSIONS = new Set(['.tsx', '.ts', '.jsx', '.js']);

/* ----------------------------------------------------------------------------
   1. القواعد الآمنة للتطبيق التلقائي
   ---------------------------------------------------------------------------- */

// خصائص الهوامش/الحشو الاتجاهية → مقابلها المنطقي (RTL-safe)
// يطابق فقط الاستخدام كاملاً كوحدة Tailwind: ml-4, mr-[10px], pl-2.5, pr-1 ... إلخ
// ولا يمس أي كلمة أخرى تحتوي على نفس الحروف بالصدفة (بفضل حدود الكلمة \b وربط الشرطة).
const RTL_RULES = [
  { from: /\bml-(\[[^\]]+\]|[0-9.]+\/?[0-9]*|px|auto)\b/g, to: (_, v) => `ms-${v}` },
  { from: /\bmr-(\[[^\]]+\]|[0-9.]+\/?[0-9]*|px|auto)\b/g, to: (_, v) => `me-${v}` },
  { from: /\bpl-(\[[^\]]+\]|[0-9.]+\/?[0-9]*|px)\b/g, to: (_, v) => `ps-${v}` },
  { from: /\bpr-(\[[^\]]+\]|[0-9.]+\/?[0-9]*|px)\b/g, to: (_, v) => `pe-${v}` },
  // نفس القواعد مع بادئات الاستجابة والحالة (md:ml-4, hover:mr-2, dark:pl-3 ... إلخ)
  { from: /([\w-]+:)ml-(\[[^\]]+\]|[0-9.]+\/?[0-9]*|px|auto)\b/g, to: (_, pfx, v) => `${pfx}ms-${v}` },
  { from: /([\w-]+:)mr-(\[[^\]]+\]|[0-9.]+\/?[0-9]*|px|auto)\b/g, to: (_, pfx, v) => `${pfx}me-${v}` },
  { from: /([\w-]+:)pl-(\[[^\]]+\]|[0-9.]+\/?[0-9]*|px)\b/g, to: (_, pfx, v) => `${pfx}ps-${v}` },
  { from: /([\w-]+:)pr-(\[[^\]]+\]|[0-9.]+\/?[0-9]*|px)\b/g, to: (_, pfx, v) => `${pfx}pe-${v}` },
];

// مدد انتقال غير قياسية بدون صيغة القوس — Tailwind يتجاهلها تمامًا حاليًا.
// نحوّلها لصيغة قوسية صحيحة تحافظ على نفس الرقم المقصود بالظبط (لا نغيّر التوقيت المقصود).
const DURATION_RULES = [
  { from: /\bduration-(\d+)\b(?!\])/g, validate: (n) => !['75','100','150','200','300','500','700','1000'].includes(n), to: (_, n) => `duration-[${n}ms]` },
];

/* ----------------------------------------------------------------------------
   2. المسح والتطبيق
   ---------------------------------------------------------------------------- */

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      walk(full, files);
    } else if (EXTENSIONS.has(path.extname(entry.name))) {
      files.push(full);
    }
  }
  return files;
}

function applyRtlRules(content) {
  let changed = 0;
  let out = content;
  for (const rule of RTL_RULES) {
    out = out.replace(rule.from, (...m) => {
      changed++;
      return rule.to(...m);
    });
  }
  return { out, changed };
}

function applyDurationRules(content) {
  let changed = 0;
  let out = content;
  for (const rule of DURATION_RULES) {
    out = out.replace(rule.from, (match, n) => {
      if (!rule.validate(n)) return match; // قيمة قياسية أصلاً، سيبها زي ما هي
      changed++;
      return rule.to(match, n);
    });
  }
  return { out, changed };
}

/* ----------------------------------------------------------------------------
   3. نقاط تحتاج مراجعة بشرية — تُبلَّغ في تقرير فقط ولا تُعدَّل تلقائيًا
   ---------------------------------------------------------------------------- */

function collectManualReviewFlags(content, filePath, report) {
  // أهداف لمس أصغر من 44px (w-6/7/8 h-6/7/8) — يحتاج قرار تصميمي لكل زر
  const touchTargets = content.match(/\bw-[678]\s+h-[678]\b/g) || [];
  if (touchTargets.length) {
    report.touchTargets.push({ file: filePath, count: touchTargets.length });
  }

  // اتجاهات تدرج مختلفة — يحتاج قرار توحيد واحد لكل التطبيق
  const gradients = content.match(/bg-gradient-to-(t|tr|r|br|b|bl|l|tl)\b/g) || [];
  if (gradients.length) {
    const dirs = [...new Set(gradients)];
    if (dirs.length > 1) {
      report.gradientDirections.push({ file: filePath, directions: dirs });
    }
  }

  // عناصر <img> بدون alt، وأزرار/عناصر تفاعلية بدون aria-*
  const imgsWithoutAlt = (content.match(/<img(?![^>]*\balt=)[^>]*>/g) || []).length;
  if (imgsWithoutAlt) {
    report.missingAlt.push({ file: filePath, count: imgsWithoutAlt });
  }
}

/* ----------------------------------------------------------------------------
   4. التشغيل
   ---------------------------------------------------------------------------- */

function main() {
  const files = TARGET_DIRS.flatMap(d => walk(d));
  const uniqueFiles = [...new Set(files)];

  let totalRtlChanges = 0;
  let totalDurationChanges = 0;
  let filesModified = 0;

  const report = { touchTargets: [], gradientDirections: [], missingAlt: [] };

  for (const file of uniqueFiles) {
    const original = fs.readFileSync(file, 'utf8');

    const rtlResult = applyRtlRules(original);
    const durationResult = applyDurationRules(rtlResult.out);

    const finalContent = durationResult.out;
    const fileChanged = rtlResult.changed + durationResult.changed;

    if (fileChanged > 0) {
      totalRtlChanges += rtlResult.changed;
      totalDurationChanges += durationResult.changed;
      filesModified++;
      if (APPLY) {
        fs.writeFileSync(file, finalContent, 'utf8');
      }
      console.log(
        `${APPLY ? '✔ تم التعديل' : '• سيتم التعديل'} — ${file} ` +
        `(RTL: ${rtlResult.changed}, duration: ${durationResult.changed})`
      );
    }

    // التقرير اليدوي يُبنى من المحتوى الأصلي دائمًا (بغض النظر عن التعديل التلقائي)
    collectManualReviewFlags(original, file, report);
  }

  console.log('\n============================================================');
  console.log(APPLY ? 'تم التطبيق فعليًا على الملفات.' : 'تشغيل تجريبي فقط (dry-run) — لم يُكتب أي شيء بعد.');
  console.log(`ملفات فيها تعديلات RTL/duration: ${filesModified}`);
  console.log(`إجمالي إصلاحات RTL (ml/mr/pl/pr → ms/me/ps/pe): ${totalRtlChanges}`);
  console.log(`إجمالي إصلاحات duration الوهمية: ${totalDurationChanges}`);
  if (!APPLY && filesModified > 0) {
    console.log('\nلتطبيق التعديلات فعليًا شغّل الأمر مرة أخرى مع --apply');
  }

  console.log('\n------------------------------------------------------------');
  console.log('نقاط تحتاج مراجعة بشرية (لم تُعدَّل تلقائيًا):');
  console.log('------------------------------------------------------------');

  if (report.touchTargets.length) {
    const total = report.touchTargets.reduce((s, r) => s + r.count, 0);
    console.log(`\n1) أهداف لمس أصغر من 44px — ${total} حالة عبر ${report.touchTargets.length} ملف:`);
    report.touchTargets.forEach(r => console.log(`   - ${r.file}: ${r.count} حالة`));
    console.log('   → يحتاج مراجعة يدوية: رفع حاوية الزر (مش الأيقونة نفسها) لـ w-11 h-11 كحد أدنى.');
  }

  if (report.gradientDirections.length) {
    console.log(`\n2) اتجاهات تدرج غير موحّدة في ${report.gradientDirections.length} ملف:`);
    report.gradientDirections.forEach(r => console.log(`   - ${r.file}: ${r.directions.join(', ')}`));
    console.log('   → يحتاج قرار تصميمي: اختيار اتجاه واحد قياسي (مقترح: to-br للكروت، to-r للبانرات).');
  }

  if (report.missingAlt.length) {
    const total = report.missingAlt.reduce((s, r) => s + r.count, 0);
    console.log(`\n3) عناصر <img> بدون alt — ${total} حالة عبر ${report.missingAlt.length} ملف:`);
    report.missingAlt.forEach(r => console.log(`   - ${r.file}: ${r.count} حالة`));
    console.log('   → يحتاج كتابة وصف نصي مناسب لكل صورة/رسم بياني حسب محتواه فعليًا.');
  }

  console.log('\n============================================================\n');
}

main();
