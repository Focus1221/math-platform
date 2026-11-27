import fs from 'node:fs';

// 1. CourseWorkspace.tsx — добавляем onProblemSolved={handlePracticeSolved} в <InteractiveTab />
{
  const file = 'src/components/lesson/CourseWorkspace.tsx';
  const text = fs.readFileSync(file, 'utf8');

  if (!text.includes('onProblemSolved={handlePracticeSolved}')) {
    const next = text.replace(/<InteractiveTab[\s\S]*?\/>/, (block) => {
      if (block.includes('onProblemSolved=')) {
        return block.replace(
          /onProblemSolved=\{[^}]+\}/,
          'onProblemSolved={handlePracticeSolved}'
        );
      }
      return block.replace(
        'onMaterialsChanged={setMaterials}',
        'onMaterialsChanged={setMaterials}\n                  onProblemSolved={handlePracticeSolved}'
      );
    });

    if (next === text) {
      console.error('[ERR] Не найден блок <InteractiveTab ... /> в', file);
    } else {
      fs.writeFileSync(file, next, 'utf8');
      console.log('[FIXED]', file);
    }
  } else {
    console.log('[SKIP] Уже исправлен:', file);
  }
}

// 2. InteractiveTab.tsx — добавляем проп onProblemSolved и вызов onProblemSolved?.(nextCorrect)
{
  const file = 'src/components/lesson/InteractiveTab.tsx';
  let text = fs.readFileSync(file, 'utf8');
  const orig = text;

  if (/onProblemSolved\?:/.test(text)) {
    text = text.replace(
      /onProblemSolved\?:[^;]+;/,
      'onProblemSolved?: (totalSolved: number) => void;'
    );
  } else {
    text = text.replace(
      'onMaterialsChanged: (next: Material[]) => void;',
      'onMaterialsChanged: (next: Material[]) => void;\n  onProblemSolved?: (totalSolved: number) => void;'
    );
  }

  text = text.replace(
    /export default function InteractiveTab\(\{[\s\S]*?\}: Props\)/,
    (header) => {
      if (header.includes('onProblemSolved')) return header;
      return header.replace(
        'onMaterialsChanged,',
        'onMaterialsChanged,\n  onProblemSolved,'
      );
    }
  );

  if (/onProblemSolved\?\.\(/.test(text)) {
    text = text.replace(
      /onProblemSolved\?\.\([^)]*\);/,
      'onProblemSolved?.(nextCorrect);'
    );
  } else {
    text = text.replace(
      "await supabase.from('topic_progress').upsert({",
      "if (isCorrect) {\n      onProblemSolved?.(nextCorrect);\n    }\n\n    await supabase.from('topic_progress').upsert({"
    );
  }

  if (text !== orig) {
    fs.writeFileSync(file, text, 'utf8');
    console.log('[FIXED]', file);
  } else {
    console.log('[SKIP] Без изменений:', file);
  }
}

// 3. globals.css — чиним невалидные селекторы со скобками
{
  const file = 'src/app/globals.css';
  let text = fs.readFileSync(file, 'utf8');
  const orig = text;

  text = text
    .replaceAll('.bg-[\\#F6F7FB]', '[class*="bg-[#F6F7FB]"]')
    .replaceAll('.bg-[\\#F4F7FB]', '[class*="bg-[#F4F7FB]"]');

  if (text !== orig) {
    fs.writeFileSync(file, text, 'utf8');
    console.log('[FIXED]', file);
  } else {
    console.log('[SKIP] Без изменений:', file);
  }
}