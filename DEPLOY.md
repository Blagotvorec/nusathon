# Публикация NUSATHON на nusathon.com

Сайт статический: сборки нет, `npm run build` его не касается. nginx отдаёт
папку `nusathon/` из того же репозитория, где живёт INCLT, поэтому обновление
сайта — это одна команда `git pull`, а телеграм-бот умеет править его теми же
надиктованными задачами, что и основной сайт.

```
nusathon.com   ──▶ nginx ──▶ /home/inclt/nusathon/
```

> `modulthon.com` больше не редирект сюда — с 8 сентября 2026 у него
> собственный сайт, см. https://github.com/Blagotvorec/modulthon.
> Блок с `return 301` из конфига убран там же, шагом 2.

Все команды выполняются на сервере `34.45.82.165`, под root
(`sudo -i` сразу после подключения). Как подключиться — шаг 2 в
инструкции INCLT.

---

## Шаг 1. DNS в GoDaddy

> **Сделано 8 сентября 2026.** Обе зоны отдают `34.45.82.165` по всем
> четырём именам. Этот шаг нужен только если домены будут переезжать.

Для **обоих** доменов одно и то же. **My Products** → у домена кнопка **DNS**.

У GoDaddy уже есть запись `A` с именем `@`, которая ведёт на их страницу-
заглушку. Её нужно **отредактировать**, а не добавить вторую рядом — две
записи `A` для `@` будут отдавать посетителей то на сайт, то на заглушку,
через раз.

| Поле | Значение |
|---|---|
| Type | `A` |
| Name | `@` |
| Value | `34.45.82.165` |
| TTL | `600` |

И вторая запись, чтобы работал адрес с `www`:

| Поле | Значение |
|---|---|
| Type | `CNAME` |
| Name | `www` |
| Value | `@` |
| TTL | `600` |

Проверить, что разошлось, — все четыре команды должны ответить
`34.45.82.165`:

```bash
dig +short nusathon.com www.nusathon.com modulthon.com www.modulthon.com
```

**Не переходите к шагу 4, пока все четыре не отвечают правильным адресом.**
Certbot выпускает сертификат, проверяя домен снаружи, и на недоехавшем DNS
просто откажет. Обычно это 10–15 минут, иногда до часа.

---

## Шаг 2. Забрать код

Сборка не нужна — забираем и всё:

```bash
sudo -iu inclt git -C /home/inclt/nusathon pull
```

Проверить, что файлы на месте:

```bash
ls /home/inclt/nusathon
```

Должны быть `index.html`, `apply.html`, `assets`, `robots.txt`,
`sitemap.xml`.

---

## Шаг 3. Настроить nginx

```bash
nano /etc/nginx/sites-available/nusathon
```

Вставьте целиком:

```nginx
# Платформа. Статика из репозитория, отдаётся напрямую.
server {
    listen 80;
    server_name nusathon.com www.nusathon.com;

    root /home/inclt/nusathon;
    index index.html;

    # У стиля и скрипта постоянные имена, без хэша сборки. Кэшировать их
    # надолго нельзя: правка не дойдёт до тех, кто уже был на сайте, а
    # почистить чужой браузер нечем. Час — достаточно, чтобы снять нагрузку,
    # и достаточно мало, чтобы правка вышла в тот же день.
    location /assets/ {
        expires 1h;
        add_header Cache-Control "public, must-revalidate";
    }

    location ~* \.html$ {
        add_header Cache-Control "no-cache";
    }

    # Сайт из двух настоящих страниц, а не SPA: чего нет — того нет, и честный
    # 404 здесь лучше, чем главная в ответ на любой промах.
    location / {
        try_files $uri $uri/ =404;
    }
}

```

Сохраните (**Ctrl+O**, Enter, **Ctrl+X**) и включите:

```bash
ln -sf /etc/nginx/sites-available/nusathon /etc/nginx/sites-enabled/nusathon
```

```bash
nginx -t && systemctl reload nginx
```

Должно написать `syntax is ok` и `test is successful`. Если ошибка — она
укажет строку.

Уже сейчас `http://nusathon.com` открывает сайт, пока без замочка.

---

## Шаг 4. Включить HTTPS

Сертификат сразу на все четыре имени, включая редирект-домен — иначе
`https://modulthon.com` будет отдавать предупреждение браузера вместо
перенаправления:

```bash
certbot --nginx -d nusathon.com -d www.nusathon.com -d modulthon.com -d www.modulthon.com
```

Когда предложит перенаправлять HTTP на HTTPS — вариант **2 / Redirect**.

certbot сам допишет в конфиг блоки на 443 и оставит редирект как есть.

---

## Шаг 5. Проверить

1. `https://nusathon.com` — сайт с замочком.
2. `https://modulthon.com` — перебрасывает на nusathon.com.
3. `https://nusathon.com/apply.html` — форма заявки.
4. Отправьте тестовую заявку: должен открыться почтовый клиент с готовым
   письмом (пока `APPLY_ENDPOINT` не переключён на сервер — см. README).
5. `https://nusathon.com/robots.txt` — отдаётся, внутри ссылка на sitemap.

---

## Обновление

Правки с ноутбука или от бота приезжают так же, как на основной сайт, только
без пересборки:

```bash
sudo -iu inclt git -C /home/inclt/nusathon pull
```

nginx перезапускать не нужно — он читает файлы с диска на каждый запрос.

---

## Если что-то не работает

| Симптом | Что смотреть |
|---|---|
| Домен не открывается совсем | `dig +short nusathon.com` — DNS ещё расходится |
| 403 Forbidden | `chmod 755 /home/inclt` (могло не быть выполнено) |
| 404 на всех страницах | Нет папки — шаг 2, проверьте `ls` |
| Открывается INCLT вместо NUSATHON | В `sites-enabled` остался `default` либо чужой блок ловит имя первым: `nginx -T \| grep server_name` |
| certbot отказывает | DNS не доехал, либо закрыт порт 80 в Google Cloud |
| Правка не видна | Кэш браузера: **Cmd+Shift+R** |

```bash
tail -50 /var/log/nginx/error.log
```
