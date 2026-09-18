EXC HUN VBL CLUB – Supabase videórendszer

1. GitHub Pages-re töltsd fel: index.html, style.css, script.js.
2. Supabase Storage-ban hozz létre egy `vbl-videos` nevű bucketet, Public = ON.
3. Állítsd a maximum fájlméretet 50 MB-ra.
4. Supabase SQL Editor -> New query -> másold be a setup.sql teljes tartalmát -> Run.
5. Authentication -> Users -> hozz létre egy admin felhasználót.
6. Másold ki az admin User UUID-ját.
7. SQL Editorban futtasd:
   INSERT INTO public.admins(user_id) VALUES ('IDE-A-UUID');
8. A weboldalon az ADMIN résznél ezzel az e-maillel/jelszóval tudsz belépni.

Fontos:
- Az admin jelszavát ne küldd el senkinek.
- A jelenlegi egyszerű verzió public Storage buckettel működik; a weboldal csak az `approved` állapotú videókat listázza.
