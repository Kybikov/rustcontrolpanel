# Історія версій Rust Control

Історія має два шари, як у WTAdmin.

## Користувацькі релізи

`data/releases.json` є єдиним джерелом коротких українських release notes для менеджерів. Перший запис — поточний реліз. Версія в ньому має збігатися з root `package.json` та `package-lock.json`.

Для нового функціонального, конфігураційного або візуального релізу:

1. Оновити `version` у root `package.json` та `package-lock.json`.
2. Додати новий запис на початок `data/releases.json`.
3. Запустити `npm run release:check`.
4. Виконати frontend/backend перевірки та локальний Docker Compose build.
5. Закомітити підготовлені зміни й запушити гілку після перевірки.

Перевірка виконується командами:

```bash
npm run release:check
npm run changelog:check
```

Секрети не є частиною changelog, `.env`, Docker image або Git history. Локальні значення підтягуються з захищеного джерела окремо.

## Технічна історія

Детальні engineering notes зберігатимуться окремим технічним журналом після появи реальних domain-комітів. Release notes не повинні перетворюватися на сирий Git log: вони описують результат для оператора.
