create table users
(
    id          serial primary key,
    telegram_id  bigint not null,
    contester_id bigint,
    contest_id   bigint,
    problem_id   integer,
    problem_slug char(10),
    last_step    varchar(20) default 'AUTHORIZATION'::character varying not null,
    role varchar(20) default 'user' not null,
    left_generations integer default 100 not null,
    email varchar(255) default '' not null
);

alter table users
    owner to postgres;

create table actions
(
    id        serial  primary key,
    user_id   integer
        constraint actions_userid_fkey
            references users,
    type      varchar(255) not null,
    details   jsonb        not null,
    timestamp timestamp default CURRENT_TIMESTAMP
);

alter table actions
    owner to postgres;


create table generations
(
    id                     serial
        primary key,
    problem_id                integer           not null,
    input                  text              not null,
    output                 text              not null,
    up_votes               integer default 0 not null,
    down_votes             integer default 0 not null,
    previous_generation_id bigint  default 0 not null,
    generation_level       bigint  default 0,
    solution_id            integer default 0,
    template_name          varchar(255) not null,
    template_variables    jsonb        not null,
);

alter table generations
    owner to postgres;


create table templates
(
    id          serial primary key,
    name         varchar(255) not null,
    template     text         not null
);

alter table public.templates
    add constraint templates_name_unique_pk
        unique (name);



alter table templates
    owner to postgres;

create table groups
(
    id          serial primary key,
    chat_id     bigint not null
);

alter table public.groups
    add constraint groups_chat_name_unique_pk
        unique (chat_id);

alter table groups
    owner to postgres;
