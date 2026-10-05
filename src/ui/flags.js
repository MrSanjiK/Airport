// Accurate flag artwork from the flag-icons library (MIT), 1:1 variants, inlined.
import uz from 'flag-icons/flags/1x1/uz.svg?raw';
import ru from 'flag-icons/flags/1x1/ru.svg?raw';
import gb from 'flag-icons/flags/1x1/gb.svg?raw';
import ae from 'flag-icons/flags/1x1/ae.svg?raw';
import cn from 'flag-icons/flags/1x1/cn.svg?raw';
import tr from 'flag-icons/flags/1x1/tr.svg?raw';
import fr from 'flag-icons/flags/1x1/fr.svg?raw';
import it from 'flag-icons/flags/1x1/it.svg?raw';
import kr from 'flag-icons/flags/1x1/kr.svg?raw';

const FLAGS = { uz, ru, gb, ae, cn, tr, fr, it, kr };

export function flagSvg(code) {
  return (FLAGS[code] || '').replace('<svg', '<svg aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid slice"');
}
