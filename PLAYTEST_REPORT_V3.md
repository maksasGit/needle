# Плейтест JSON v3 — игровые метрики и технические требования

Дата2026-11-17. Это реализованная инструментация, **не результаты запуска**. Typecheck, tests, build, браузер, профилирование и скриншоты не запускались по действующему указанию владельца. Базовый игровой баланс не менялся.

## Как пользоваться

Включить «Отчёт плейтеста» в настройках, играть, скачать needle-playtest.json. Экспорт после поднятия иголки должен содержать completed=true/contextLatest.won=true и finalStates с победой. Скачивание до иголки честно показывает только очищенный стог. Блокировка скачивания в iframe не мешает скопировать JSON из существующего поля.

Формат3/build2026-11-17-playtest-v3 сохраняет прежние экономические поля. Метрики общего плейтеста — playtest, техническая сводка — playtest.technical. Старые v1/v2 JSON остаются данными старых схем; новых метрик в них задним числом нет.

## Связь записей и приватность

Пользователь явно одобрил случайный ID забега. При включении записи RunState получает playtestId (случайный UUID/nonce) и счётчик playtestSegment; ID сохраняется после reload, новый заход получает новый ID. Поля опциональны для старых saves; основной формат SaveData остаётся9. Экспорт содержит их в contextStart/contextLatest.sessionLink вместе с часами забега. Каждый сегмент имеет случайный reportId: повторные выгрузки одного сегмента — накопительные снимки, их нельзя складывать.

Reload/выключение-включение/сброс отчёта создают новые сегменты. Номер сохраняется обычным game checkpoint; аварийное закрытие до записи может оставить номер прежним — различать также reportId/интервалы часов/состояние стога. Совпадение runId позволяет сопоставлять сегменты, но само не доказывает полное покрытие без пропусков и пересечений. Автоматической склейки и архива всех файлов нет: выгружать каждый нужный сегмент вручную.

Это ID **забега**, не игрока/устройства. Не экспортируются основной run.id с датой, raw UA, URL/stack/message ошибок, GPU fingerprint, координаты касаний, клавиши/маршрут игрока, содержимое localStorage или личные комментарии. Из четырёх собственных game keys читаются только размеры; telemetry cache измеряется отдельно. Нет upload/backend. Единственный новый запрос — локальный technical-build.json из собственной production-сборки при включённых замерах.

## Добавленные игровые данные

| Раздел | Содержание / ограничения |
|---|---|
| stages[0…10] | Интервалы10% от **totalHay стога**, отдельно пустой стог; count/total/max frame ms, >33.4ms, выборочные max calls/triangles/JS heap, сумма CPU ms. В отличие от v2 база — весь стог, не startHay сегмента |
| collection[0…4] | Начатые/завершённые/отменённые/занятые/full attempts по инструментам; источники pointer/keyboard/action/hold-start/hold-repeat. Это команды, не обязательно клики |
| fullInventory | Секунды полной сумки в движении/на месте и попытки сбора с полной сумкой. Стоящий игрок мог осматриваться — это не доказанное бесполезное время |
| pigs | Индекс свинки + уровень порции/скорости; прогулки/подход/ожидание, укусы, сено, обычные монеты/редкости; до64 комбинаций. Это observational сравнение, не причинный A/B тест |
| purchases.details | Инвентарь/остаток/кошелёк, инструмент, объём/длительность, скорость/цена продажи, свинки/уровни до и после coin-покупки; прежний предел200 записей. Метапокупки по-прежнему агрегированы по ключу + контексту |
| chest | Был ли активный сундук при начале записи, число первых попаданий его таймера в экран. Существующие spawn/expire/claim counters сохраняются. «Виден» означает проекцию внутри viewport, без проверки стены/occlusion и без доказательства внимания игрока |
| finalStates | Очистка стога (часы забега и сегмента), иголка, победа, исход записи рекорда (stored/storage-failed/ineligible), причина завершения сегмента. Первая успешная наблюдаемая коллекция — performance.now от начала навигации |
| viewports | До8 различных CSS размеров/DPR, текущее разрешение canvas и renderer pixel ratio в контексте. Наблюдение размеров не доказывает удобство обеих ориентаций |

Перцентили frameSummary.p50/p95/p99BucketUpperMs — верхние границы7 корзин, не точные перцентили. Null означает отсутствие замеров или попадание за250ms; смотреть count/histogram. CPU — синхронное время исполнения Game на главном потоке; scenePicking включает updateMatrixWorld и updateAim, renderCpu включает вызовы renderer/view-model. Это **не GPU frame time** и не инструмент точного профилирования отдельных функций.

## Технические требования в JSON

Все статусы — локальные наблюдения, не сертификат готовности к публикации.

| Требование | Источник и представление |
|---|---|
| Начальная загрузка <15MiB предпочтительно, потолок30MiB | initialDownload хранит доступную Resource Timing сумму первого кадра, но статус unknown: незавершённые ресурсы/кэш/ограничения/HTML исключены. Это не cold-cache transfer всего пакета |
| Общая сборка <250MiB | totalBundle из production-инвентаря; несжатые файлы выходного каталога, включая сам manifest |
| Файл <512KiB желательно, потолок30MiB | largestFile из production-инвентаря, предупреждение above-preferred и превышение exceeds-ceiling |
| ≤8000 файлов | fileCount из production-инвентаря |
| JS heap <512MiB | jsHeap по выборочным доступным performance.memory.usedJSHeapSize; null→unknown; within-observed-range не доказывает отсутствие более высокого пика |
| Save <500KiB желательно, потолок3MiB | saveUtf8Bytes — измеренный размер checkpoint; gameSaveTotal — собственные save/settings/records/tutorial вместе. Telemetry cache показан отдельно |
| Первый осмысленный ввод цель3с / общий ориентир5с | startup содержит Game→render, navigation→render и первую **наблюдаемую** успешную коллекцию. Статус unknown: человеческая задержка/позднее включение/сеть не позволяют автоматически сертифицировать TTI |
| Плавность | Гистограмма, приближённый FPS, CPU и long tasks. frameComfort использует справочный16.7ms/60FPS и долю кадров>33.4ms, не новый формальный релизный лимит |
| WebGL восстановление | Количество потерь/восстановлений и время между соответствующими сигналами. Отсутствие потери не доказывает восстановление |
| Crash rate, GPU/process memory, leak при10 рестартах, real mobile, itch.io, orientation usability | Явно unknown: один браузерный JSON этого не измеряет |

Для измеренных величин используются статусы unknown / above-preferred / exceeds-ceiling / within-observed-range. Последний означает только наблюдённые значения, не release pass. Большая доля медленных кадров помечается investigate; меньше120 кадров — insufficient-samples.

## Размеры сборки

Vite plugin technical-build-inventory при **следующей** production-сборке создаст technical-build.json. Считает реальный output (включая HTML/JS/CSS/GLB/audio/другие выведенные файлы), max file bytes, количество, сумму и группы по расширениям. Общие числа включают manifest; byExtension исключает его. Это не размер zip, HTTP gzip/brotli или первоначального критического скачивания.

Во время dev или при отсутствующем/непрочитанном manifest показатели сборки unknown. Не сканируем public/исходники и не выдаём их размеры за dist. В этой задаче build не запускался и manifest не измерялся. Новый JSON не содержит имён файлов/путей. Запрос отложен до opt-in и не блокирует первый игровой кадр; отказ не ломает игру.

## Сохранение и технические ограничения

Technical.save разделяет:
- snapshotTotalMs: подготовку копий/упаковку сена до SaveSystem.write;
- serializationTotalMs: JSON.stringify;
- storageTotalMs: успешный localStorage.setItem;
- totalMs/maxTotalMs: весь замер, включая размер UTF-8 и накладные расходы;
- peakUtf8Bytes/count/failures.

Blob используется для UTF-8 размера только при включённых замерах. Замер write-failure может не иметь полного времени storage/serialization: смотреть failures. Код ограничения/транзакции игрового сохранения не меняется.

Runtime network содержит только суммы/count доступного Resource Timing buffer: transfer/encoded/decoded/zero-transfer/largest encoded. Это не полная трасса сети; нет URL и гарантии полноты буфера. Optional longtask observer включён только на время opt-in, включает меню, не GPU, очищается при stop/reset/dispose. WebGL recovery — наблюдаемый lifecycle, без искусственного context loss.

## Нагрузка и ручная приёмка

Не храним каждый кадр/событие. Прежние cap200 purchases/trips,64 counters,24 denials,11 milestones; дополнительно11 stage rows,5 tool rows,64 pig groups,8 viewport rows,≤12 terminal fields. Pig group row кешируется по индексу/уровням; frame CPU/counters — скаляры без frame JSON. Renderer/heap сэмплируются раз60 отрисованных кадров. Build JSON грузится один раз на модуль, только production/opt-in. Все новые обработчики отключаются при stop/dispose, при reset обновляются без роста observer-ов.

Ручная проверка владельцем после обновления:
- [ ] Export v3: links/reportId/stages/tools/full/pigs/purchase details/technical присутствуют, old top-level economy fields сохранены.
- [ ] Reload одного захода сохраняет runId, меняет segment/reportId; New Game меняет runId. Повторная выгрузка одного сегмента не создаёт новый reportId.
- [ ] Очистка→иголка→победа/рекорд видны отдельно; экспортировать после иголки.
- [ ] Busy/cancel/full и hold-repeat не меняют управление/очередь действий.
- [ ] Пауза/фон не входят в frame stages; long tasks помечены как весь opt-in window.
- [ ] Dev показывает неизвестные build sizes; после разрешённой production-сборки manifest попадает в dist и корректно читается внутри iframe.
- [ ] Отключение/сброс/рестарт не размножают observers/listeners и не отправляют данные наружу.

Реальные мобильные/production/10 рестартов/профилирование по-прежнему требуют отдельного разрешения на проверки и фактических замеров.
CPU-поля используют performance.now вокруг синхронных участков: это wall time на главном потоке (включая возможные GC/driver waits), не занятость процессора. Network encoded/decoded body bytes относятся к HTTP, не к памяти текстур/GPU.

## Semantics refinements-r1 (2026-11-17)

Build2026-11-17-refinements-r1 / revision foreground-time-shadow-proxy-pig-return-v1 помечает foreground-wall таймеры событий/сбора/свинок и proxy hay shadow. gameSeconds остаётся limited physics clock; разница с activeSeconds больше не означает, что события тоже используют capped dt. eventSeconds клипуется оставшимся временем×2. Тестовый production inventory уже создан/проверен (≈5.60MiB,16files); это не cold-cache mobile/itch verification. Свинки speed уменьшают cooldown и3×.9^level порог прогулки, маршруты/ходьба прежние. Сравнивать отчёты r1 и старые v3 с учётом изменившихся часов/AI/shadow policy. Фактические адресные результаты — needle-in-a-haystack/verification/REFINEMENTS_2026-11-17.md.
