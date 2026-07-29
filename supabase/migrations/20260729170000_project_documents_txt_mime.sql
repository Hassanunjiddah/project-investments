-- The Create-Project wizard advertises "PDF, DOCX or TXT" briefs, but the
-- project-documents bucket never allowed text mime types, so TXT uploads
-- failed with "mime type text/plain is not supported".
--
-- 2026-07-29

update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/plain',
  'text/markdown'
]
where id = 'project-documents';
