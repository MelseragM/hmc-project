# إعادة تطبيق كل التعديلات بعد أي git pull / reset

كل الشغل معمول بحيث يتعاد بالكامل بأمرين. الملفات المصدرية:

| ملف | وظيفته |
|---|---|
| `tools/update-collection.js` | يعيد بناء كل تعديلات الـPostman Collection (bodies/urls/descriptions + كل الـexamples الحقيقية والمتوقعة) فوق أي نسخة من الملف |
| `tools/results-phase*.json` | الـresponses الحقيقية الملتقطة من staging (مصدر الـexamples — لا تحذفها) |
| `tools/backend-code-updates.patch` | تعديلات الـSwagger/DTO في الكود (أمثلة القيم الشغالة + الملاحظات) |
| `tools/reapply-all.ps1` | ينفّذ كل الخطوات بالترتيب |

## الخطوات (أو شغّل `tools/reapply-all.ps1`)

```powershell
# 1) كود الـSwagger/DTOs (لو الـpull رجّع الملفات القديمة)
cd "C:\New folder\hmc-project"
git apply --3way "tools\backend-code-updates.patch"   # لو فشل: git apply --reject وراجع ملفات .rej

# 2) الـPostman Collection (يشتغل فوق أي baseline)
node "tools\update-collection.js"

# 3) تأكيد
node "tools\verify-collection.js"
cd HMC_BackEnd; npm.cmd run build
```

ملاحظات:
- `update-collection.js` idempotent — تشغيله أكتر من مرة آمن، وبيشتغل على النسخة القديمة أو الجديدة من الـcollection (بيدوّر بالأسماء).
- الـexamples المعلَّمة **"Expected Success ... (NOT a captured response)"** مبنية من الكود للـendpoints المحجوبة بمشاكل DB/بيئة staging — باقي الـexamples كلها responses حقيقية ملتقطة.
- ملف `leave.oracle.repository.ts` اترجّع لنسخة الفريق (commit 347242f فيها إصلاح أحدث) — مش ضمن الـpatch.
