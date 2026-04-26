"""Service layer.

Conventions:
- Every public function takes the Supabase client as its first argument.
  The client is the security boundary: a user-scoped client transparently
  enforces RLS, a service-role client bypasses it.
- For tables with a server-managed user_id, the function takes user_id explicitly
  and writes it to the row. RLS then double-checks that user_id == auth.uid().
- Functions return Pydantic models, never raw dicts.
- 404s and validation errors are raised as exceptions; routers translate them
  to HTTP responses.
"""
