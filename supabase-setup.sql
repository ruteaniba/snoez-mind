
-- 1. Tabela de Crianças/Pacientes
create table if not exists criancas (
  id uuid default uuid_generate_v4() primary key,
  terapeuta_id uuid references profiles(id) on delete cascade,
  nome text not null,
  data_nascimento date,
  responsavel text,
  observacoes text,
  created_at timestamp default now()
);

-- 2. Tabela de Sessões de Jogos (Relatórios)
create table if not exists sessoes (
  id uuid default uuid_generate_v4() primary key,
  crianca_id uuid references criancas(id) on delete cascade,
  jogo_nome text not null,
  pontuacao int,
  tempo_segundos int,
  acertos int,
  erros int,
  data_sessao timestamp default now()
);

-- 3. Tabela de Anamnese
create table if not exists anamnese (
  id uuid default uuid_generate_v4() primary key,
  crianca_id uuid references criancas(id) on delete cascade,
  queixa_principal text,
  historico_familiar text,
  historico_escolar text,
  notas_sessao text,
  ultima_atualizacao timestamp default now()
);

-- 4. Ativar Segurança (RLS - Row Level Security) para proteger os dados
alter table criancas enable row level security;
alter table sessoes enable row level security;
alter table anamnese enable row level security;

-- 5. Criar Políticas: O terapeuta só pode ver e editar os seus próprios pacientes
create policy "Terapeutas veem suas proprias criancas" on criancas
  for all using (auth.uid() = terapeuta_id);

create policy "Terapeutas veem sessoes de suas criancas" on sessoes
  for all using (
    exists (select 1 from criancas where criancas.id = sessoes.crianca_id and criancas.terapeuta_id = auth.uid())
  );

create policy "Terapeutas veem anamnese de suas criancas" on anamnese
  for all using (
    exists (select 1 from criancas where criancas.id = anamnese.crianca_id and criancas.terapeuta_id = auth.uid())
  );

