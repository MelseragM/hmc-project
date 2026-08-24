SELECT USER AS db_user, SYS_CONTEXT('USERENV','CURRENT_SCHEMA') AS cur_schema FROM DUAL
----
SELECT owner, object_type, status FROM all_objects WHERE object_name = 'XXHMC_SND_PHONE_TYPE_V'
----
SELECT owner, object_name, object_type, status FROM all_objects WHERE object_name LIKE 'XXHMC_SND_PHONE%' ORDER BY 2,3
