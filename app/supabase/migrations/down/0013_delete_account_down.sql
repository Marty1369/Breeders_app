-- Down-migration for 0013. Removes the self-service account deletion RPC.
drop function if exists delete_account();
