import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Política de Privacidade | Bot Reserva',
  description:
    'Política de Privacidade do Bot Reserva - Sistema CRM WhatsApp para hotéis. Saiba como coletamos, usamos e protegemos seus dados.',
  keywords: [
    'política de privacidade',
    'LGPD',
    'proteção de dados',
    'WhatsApp Business',
    'Bot Reserva',
  ],
  openGraph: {
    title: 'Política de Privacidade | Bot Reserva',
    description:
      'Política de Privacidade do Bot Reserva - Sistema CRM WhatsApp para hotéis',
    url: 'https://www.botreserva.com.br/privacy-policy',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
  },
};

interface SectionProps {
  readonly title: string;
  readonly children: React.ReactNode;
}

function Section({ title, children }: SectionProps): React.JSX.Element {
  return (
    <section className="mb-8">
      <h2 className="mb-4 text-2xl font-semibold text-gray-900">{title}</h2>
      {children}
    </section>
  );
}

interface SubSectionProps {
  readonly title: string;
  readonly children: React.ReactNode;
}

function SubSection({ title, children }: SubSectionProps): React.JSX.Element {
  return (
    <div className="mb-4">
      <h3 className="mb-2 text-xl font-medium text-gray-800">{title}</h3>
      {children}
    </div>
  );
}

function Paragraph({
  children,
}: {
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return <p className="mb-4 leading-relaxed text-gray-700">{children}</p>;
}

function List({
  children,
}: {
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return <ul className="mb-4 ml-6 list-disc space-y-2 text-gray-700">{children}</ul>;
}

function ListItem({
  children,
}: {
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return <li className="leading-relaxed">{children}</li>;
}

function Strong({
  children,
}: {
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return <strong className="font-semibold text-gray-900">{children}</strong>;
}

export default function PrivacyPolicyPage(): React.JSX.Element {
  const lastUpdated = '17 de novembro de 2025';

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="mb-12 border-b border-gray-200 pb-8">
          <h1 className="mb-4 text-4xl font-bold text-gray-900 sm:text-5xl">
            Política de Privacidade
          </h1>
          <div className="flex flex-col gap-2 text-sm text-gray-600 sm:flex-row sm:gap-4">
            <span>
              <Strong>Bot Reserva</Strong>
            </span>
            <span className="hidden sm:inline">•</span>
            <span>Última atualização: {lastUpdated}</span>
          </div>
        </header>

        {/* Content */}
        <article className="prose prose-gray max-w-none">
          {/* Introdução */}
          <Section title="1. Introdução">
            <Paragraph>
              A <Strong>Bot Reserva</Strong>, operadora do sistema de CRM via WhatsApp
              para hotéis, está comprometida com a proteção da sua privacidade e dos
              seus dados pessoais. Esta Política de Privacidade descreve como
              coletamos, usamos, armazenamos e protegemos suas informações ao utilizar
              nossos serviços através da plataforma WhatsApp Business API.
            </Paragraph>
            <Paragraph>
              Esta política está em conformidade com a{' '}
              <Strong>Lei Geral de Proteção de Dados (LGPD - Lei 13.709/2018)</Strong>{' '}
              e com as diretrizes da{' '}
              <Strong>Meta Platforms, Inc. (WhatsApp Business API)</Strong>.
            </Paragraph>
          </Section>

          {/* Dados Coletados */}
          <Section title="2. Dados Coletados">
            <Paragraph>
              Para fornecer nossos serviços de CRM via WhatsApp, coletamos e processamos
              as seguintes categorias de dados:
            </Paragraph>

            <SubSection title="2.1. Dados de Identificação">
              <List>
                <ListItem>
                  <Strong>Nome completo:</Strong> para personalização do atendimento
                </ListItem>
                <ListItem>
                  <Strong>Número de telefone:</Strong> para comunicação via WhatsApp
                </ListItem>
                <ListItem>
                  <Strong>Endereço de e-mail:</Strong> quando fornecido voluntariamente
                </ListItem>
                <ListItem>
                  <Strong>Foto de perfil do WhatsApp:</Strong> quando disponível
                  publicamente
                </ListItem>
              </List>
            </SubSection>

            <SubSection title="2.2. Dados de Comunicação">
              <List>
                <ListItem>
                  <Strong>Mensagens trocadas:</Strong> conteúdo das conversas via
                  WhatsApp
                </ListItem>
                <ListItem>
                  <Strong>Arquivos multimídia:</Strong> imagens, vídeos, áudios e
                  documentos enviados
                </ListItem>
                <ListItem>
                  <Strong>Metadados:</Strong> data, hora, status de entrega e leitura
                  das mensagens
                </ListItem>
                <ListItem>
                  <Strong>Preferências de contato:</Strong> horários preferenciais e
                  canais de comunicação
                </ListItem>
              </List>
            </SubSection>

            <SubSection title="2.3. Dados de Reserva">
              <List>
                <ListItem>
                  <Strong>Informações de reserva:</Strong> datas, quantidade de pessoas,
                  tipo de quarto
                </ListItem>
                <ListItem>
                  <Strong>Preferências:</Strong> necessidades especiais, requisitos
                  alimentares
                </ListItem>
                <ListItem>
                  <Strong>Histórico de interações:</Strong> reservas anteriores e
                  preferências registradas
                </ListItem>
              </List>
            </SubSection>

            <SubSection title="2.4. Dados Técnicos">
              <List>
                <ListItem>
                  <Strong>Identificadores de dispositivo:</Strong> fornecidos pela API
                  do WhatsApp
                </ListItem>
                <ListItem>
                  <Strong>Logs de sistema:</Strong> para diagnóstico e segurança
                </ListItem>
                <ListItem>
                  <Strong>Dados de sessão:</Strong> tempo de interação e engajamento
                </ListItem>
              </List>
            </SubSection>
          </Section>

          {/* Finalidade do Uso dos Dados */}
          <Section title="3. Finalidade e Uso dos Dados">
            <Paragraph>Utilizamos seus dados pessoais para as seguintes finalidades:</Paragraph>

            <SubSection title="3.1. Prestação de Serviços">
              <List>
                <ListItem>
                  Gerenciar e processar reservas de hospedagem através do WhatsApp
                </ListItem>
                <ListItem>
                  Fornecer atendimento automatizado e personalizado via chatbot
                </ListItem>
                <ListItem>
                  Enviar confirmações, lembretes e atualizações sobre suas reservas
                </ListItem>
                <ListItem>Responder dúvidas e solicitações de suporte</ListItem>
              </List>
            </SubSection>

            <SubSection title="3.2. Melhorias e Análises">
              <List>
                <ListItem>
                  Analisar padrões de uso para melhorar a experiência do usuário
                </ListItem>
                <ListItem>
                  Desenvolver novos recursos e otimizar funcionalidades existentes
                </ListItem>
                <ListItem>
                  Realizar pesquisas de satisfação e coletar feedback
                </ListItem>
                <ListItem>Gerar relatórios estatísticos agregados e anonimizados</ListItem>
              </List>
            </SubSection>

            <SubSection title="3.3. Segurança e Conformidade">
              <List>
                <ListItem>Detectar e prevenir fraudes e atividades suspeitas</ListItem>
                <ListItem>
                  Garantir a segurança e integridade da plataforma
                </ListItem>
                <ListItem>
                  Cumprir obrigações legais e regulatórias aplicáveis
                </ListItem>
                <ListItem>Resolver disputas e fazer cumprir nossos termos de uso</ListItem>
              </List>
            </SubSection>

            <SubSection title="3.4. Comunicação de Marketing (com consentimento)">
              <List>
                <ListItem>
                  Enviar ofertas especiais e promoções de hotéis parceiros
                </ListItem>
                <ListItem>
                  Compartilhar novidades sobre serviços e funcionalidades
                </ListItem>
                <ListItem>
                  Enviar pesquisas de satisfação e programas de fidelidade
                </ListItem>
              </List>
              <Paragraph>
                <Strong>Importante:</Strong> Você pode revogar seu consentimento para
                comunicações de marketing a qualquer momento através do comando &quot;SAIR&quot; ou
                entrando em contato conosco.
              </Paragraph>
            </SubSection>
          </Section>

          {/* Armazenamento e Segurança */}
          <Section title="4. Armazenamento e Segurança dos Dados">
            <SubSection title="4.1. Medidas de Segurança">
              <Paragraph>
                Implementamos rigorosas medidas técnicas e organizacionais para proteger
                seus dados pessoais:
              </Paragraph>
              <List>
                <ListItem>
                  <Strong>Criptografia:</Strong> Todos os dados são criptografados em
                  trânsito (TLS 1.3) e em repouso (AES-256)
                </ListItem>
                <ListItem>
                  <Strong>Controle de acesso:</Strong> Acesso restrito baseado em
                  funções (RBAC) com autenticação multifator
                </ListItem>
                <ListItem>
                  <Strong>Monitoramento:</Strong> Logs de auditoria e detecção de
                  anomalias 24/7
                </ListItem>
                <ListItem>
                  <Strong>Backup:</Strong> Backups diários criptografados com retenção
                  conforme políticas
                </ListItem>
                <ListItem>
                  <Strong>Testes de segurança:</Strong> Auditorias periódicas e testes
                  de penetração
                </ListItem>
              </List>
            </SubSection>

            <SubSection title="4.2. Localização dos Dados">
              <Paragraph>
                Seus dados são armazenados em servidores seguros localizados no{' '}
                <Strong>Brasil</Strong>, em data centers certificados ISO 27001 e SOC 2,
                garantindo conformidade com a LGPD.
              </Paragraph>
            </SubSection>

            <SubSection title="4.3. Período de Retenção">
              <List>
                <ListItem>
                  <Strong>Dados de reserva ativa:</Strong> Durante a vigência da reserva
                  e por até 5 anos após o check-out
                </ListItem>
                <ListItem>
                  <Strong>Mensagens e conversas:</Strong> Retidos por até 2 anos para
                  fins de suporte e qualidade
                </ListItem>
                <ListItem>
                  <Strong>Dados de marketing:</Strong> Até a revogação do consentimento
                  ou 2 anos de inatividade
                </ListItem>
                <ListItem>
                  <Strong>Logs técnicos:</Strong> 12 meses para segurança e
                  conformidade
                </ListItem>
                <ListItem>
                  <Strong>Dados fiscais/legais:</Strong> Conforme exigido por lei (até 5
                  anos)
                </ListItem>
              </List>
              <Paragraph>
                Após o período de retenção, os dados são anonimizados ou excluídos de
                forma segura e irreversível.
              </Paragraph>
            </SubSection>
          </Section>

          {/* Compartilhamento de Dados */}
          <Section title="5. Compartilhamento e Transferência de Dados">
            <Paragraph>
              Seus dados pessoais podem ser compartilhados com as seguintes entidades:
            </Paragraph>

            <SubSection title="5.1. Meta Platforms, Inc. (WhatsApp)">
              <Paragraph>
                Como utilizamos a <Strong>WhatsApp Business API</Strong>, alguns dados
                são processados pela Meta Platforms, Inc., de acordo com:
              </Paragraph>
              <List>
                <ListItem>
                  Política de Privacidade do WhatsApp:{' '}
                  <a
                    href="https://www.whatsapp.com/legal/privacy-policy"
                    className="text-blue-600 hover:text-blue-800 hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    https://www.whatsapp.com/legal/privacy-policy
                  </a>
                </ListItem>
                <ListItem>
                  Termos de Serviço do WhatsApp Business:{' '}
                  <a
                    href="https://www.whatsapp.com/legal/business-terms"
                    className="text-blue-600 hover:text-blue-800 hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    https://www.whatsapp.com/legal/business-terms
                  </a>
                </ListItem>
              </List>
            </SubSection>

            <SubSection title="5.2. Hotéis Parceiros">
              <Paragraph>
                Compartilhamos informações necessárias com os hotéis para processar suas
                reservas:
              </Paragraph>
              <List>
                <ListItem>Dados de identificação e contato</ListItem>
                <ListItem>Informações de reserva e preferências</ListItem>
                <ListItem>Histórico de comunicação relevante</ListItem>
              </List>
            </SubSection>

            <SubSection title="5.3. Prestadores de Serviços">
              <Paragraph>
                Trabalhamos com fornecedores terceirizados que processam dados em nosso
                nome:
              </Paragraph>
              <List>
                <ListItem>
                  <Strong>Provedores de infraestrutura em nuvem</Strong> (hospedagem e
                  armazenamento)
                </ListItem>
                <ListItem>
                  <Strong>Serviços de análise e monitoramento</Strong> (performance e
                  segurança)
                </ListItem>
                <ListItem>
                  <Strong>Ferramentas de suporte ao cliente</Strong> (atendimento e
                  tickets)
                </ListItem>
              </List>
              <Paragraph>
                Todos os prestadores de serviços são contratualmente obrigados a
                proteger seus dados e usá-los apenas conforme nossas instruções.
              </Paragraph>
            </SubSection>

            <SubSection title="5.4. Autoridades Legais">
              <Paragraph>
                Podemos divulgar seus dados quando exigido por lei, ordem judicial ou
                regulamentação aplicável.
              </Paragraph>
            </SubSection>

            <SubSection title="5.5. Transferência Internacional">
              <Paragraph>
                Alguns de nossos prestadores de serviços podem estar localizados fora do
                Brasil. Nesses casos, garantimos que:
              </Paragraph>
              <List>
                <ListItem>
                  Utilizamos cláusulas contratuais padrão aprovadas pela ANPD
                </ListItem>
                <ListItem>
                  Verificamos que o país possui nível adequado de proteção de dados
                </ListItem>
                <ListItem>
                  Implementamos salvaguardas técnicas e jurídicas adicionais
                </ListItem>
              </List>
            </SubSection>
          </Section>

          {/* Direitos do Usuário */}
          <Section title="6. Seus Direitos (LGPD)">
            <Paragraph>
              Conforme a Lei Geral de Proteção de Dados (LGPD), você possui os seguintes
              direitos:
            </Paragraph>

            <List>
              <ListItem>
                <Strong>Confirmação e acesso:</Strong> Saber se processamos seus dados e
                acessar uma cópia deles
              </ListItem>
              <ListItem>
                <Strong>Correção:</Strong> Solicitar a correção de dados incompletos,
                inexatos ou desatualizados
              </ListItem>
              <ListItem>
                <Strong>Anonimização ou exclusão:</Strong> Requerer a anonimização ou
                eliminação de dados desnecessários ou excessivos
              </ListItem>
              <ListItem>
                <Strong>Portabilidade:</Strong> Receber seus dados em formato
                estruturado e interoperável
              </ListItem>
              <ListItem>
                <Strong>Revogação do consentimento:</Strong> Retirar o consentimento
                para tratamentos baseados nessa base legal
              </ListItem>
              <ListItem>
                <Strong>Informação sobre compartilhamento:</Strong> Saber com quais
                entidades seus dados são compartilhados
              </ListItem>
              <ListItem>
                <Strong>Oposição:</Strong> Opor-se ao tratamento de dados em certas
                situações
              </ListItem>
              <ListItem>
                <Strong>Revisão de decisões automatizadas:</Strong> Solicitar revisão de
                decisões tomadas com base em tratamento automatizado
              </ListItem>
            </List>

            <SubSection title="6.1. Como Exercer Seus Direitos">
              <Paragraph>
                Para exercer qualquer um desses direitos, entre em contato conosco:
              </Paragraph>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <List>
                  <ListItem>
                    <Strong>E-mail:</Strong>{' '}
                    <a
                      href="mailto:contato@botreserva.com.br"
                      className="text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      contato@botreserva.com.br
                    </a>
                  </ListItem>
                  <ListItem>
                    <Strong>Assunto:</Strong> &quot;Solicitação LGPD - [Seu Direito]&quot;
                  </ListItem>
                  <ListItem>
                    <Strong>Prazo de resposta:</Strong> Até 15 dias úteis
                  </ListItem>
                </List>
              </div>
              <Paragraph>
                Podemos solicitar informações adicionais para verificar sua identidade
                antes de processar a solicitação.
              </Paragraph>
            </SubSection>
          </Section>

          {/* Cookies e Tecnologias */}
          <Section title="7. Cookies e Tecnologias Similares">
            <Paragraph>
              Nossa plataforma web pode utilizar cookies e tecnologias similares para:
            </Paragraph>
            <List>
              <ListItem>Manter sua sessão ativa e segura</ListItem>
              <ListItem>Lembrar suas preferências e configurações</ListItem>
              <ListItem>Analisar o desempenho e uso da plataforma</ListItem>
              <ListItem>Personalizar conteúdo e recomendações</ListItem>
            </List>
            <Paragraph>
              Você pode gerenciar suas preferências de cookies através das configurações
              do seu navegador.
            </Paragraph>
          </Section>

          {/* Menores de Idade */}
          <Section title="8. Proteção de Menores de Idade">
            <Paragraph>
              Nossos serviços não são direcionados a menores de 18 anos. Não coletamos
              intencionalmente dados de crianças ou adolescentes.
            </Paragraph>
            <Paragraph>
              Se você é pai, mãe ou responsável legal e acredita que seu filho forneceu
              dados pessoais, entre em contato imediatamente para que possamos removê-los.
            </Paragraph>
          </Section>

          {/* Segurança WhatsApp */}
          <Section title="9. Segurança do WhatsApp">
            <Paragraph>
              É importante destacar que o <Strong>WhatsApp</Strong> utiliza:
            </Paragraph>
            <List>
              <ListItem>
                <Strong>Criptografia de ponta a ponta:</Strong> Suas mensagens são
                criptografadas entre você e o destinatário
              </ListItem>
              <ListItem>
                <Strong>Protocolo Signal:</Strong> Tecnologia de segurança reconhecida
                mundialmente
              </ListItem>
            </List>
            <Paragraph>
              Apesar da criptografia do WhatsApp, nosso sistema armazena o conteúdo das
              mensagens para fornecer o serviço de CRM conforme descrito nesta política.
            </Paragraph>
          </Section>

          {/* Alterações na Política */}
          <Section title="10. Alterações nesta Política">
            <Paragraph>
              Podemos atualizar esta Política de Privacidade periodicamente para refletir
              mudanças em nossas práticas, legislação ou serviços.
            </Paragraph>
            <Paragraph>
              Alterações significativas serão comunicadas através de:
            </Paragraph>
            <List>
              <ListItem>Notificação via WhatsApp para usuários ativos</ListItem>
              <ListItem>Aviso destacado em nosso site</ListItem>
              <ListItem>E-mail para contatos cadastrados</ListItem>
            </List>
            <Paragraph>
              A data da última atualização sempre será indicada no topo deste documento.
            </Paragraph>
          </Section>

          {/* Encarregado de Dados */}
          <Section title="11. Encarregado de Proteção de Dados (DPO)">
            <Paragraph>
              Conforme a LGPD, designamos um Encarregado de Proteção de Dados para
              atuar como canal de comunicação entre você, a Bot Reserva e a Autoridade
              Nacional de Proteção de Dados (ANPD).
            </Paragraph>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <Paragraph>
                <Strong>Contato do DPO:</Strong>
              </Paragraph>
              <List>
                <ListItem>
                  <Strong>E-mail:</Strong>{' '}
                  <a
                    href="mailto:contato@botreserva.com.br"
                    className="text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    contato@botreserva.com.br
                  </a>
                </ListItem>
                <ListItem>
                  <Strong>Assunto:</Strong> &quot;DPO - Proteção de Dados&quot;
                </ListItem>
              </List>
            </div>
          </Section>

          {/* Base Legal */}
          <Section title="12. Base Legal para Tratamento de Dados">
            <Paragraph>
              Tratamos seus dados pessoais com base nas seguintes hipóteses legais da
              LGPD:
            </Paragraph>
            <List>
              <ListItem>
                <Strong>Execução de contrato:</Strong> Para fornecer os serviços de CRM
                e processar reservas
              </ListItem>
              <ListItem>
                <Strong>Consentimento:</Strong> Para comunicações de marketing e
                funcionalidades opcionais
              </ListItem>
              <ListItem>
                <Strong>Legítimo interesse:</Strong> Para melhorias, análises e
                segurança da plataforma
              </ListItem>
              <ListItem>
                <Strong>Obrigação legal:</Strong> Para cumprimento de leis e
                regulamentos aplicáveis
              </ListItem>
            </List>
          </Section>

          {/* Reclamações */}
          <Section title="13. Reclamações e ANPD">
            <Paragraph>
              Se você não estiver satisfeito com nossa resposta a uma solicitação ou
              acreditar que seus direitos foram violados, você pode:
            </Paragraph>
            <List>
              <ListItem>
                Apresentar uma reclamação à{' '}
                <Strong>Autoridade Nacional de Proteção de Dados (ANPD)</Strong>
              </ListItem>
              <ListItem>
                Site da ANPD:{' '}
                <a
                  href="https://www.gov.br/anpd"
                  className="text-blue-600 hover:text-blue-800 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  https://www.gov.br/anpd
                </a>
              </ListItem>
            </List>
          </Section>

          {/* Contato */}
          <Section title="14. Entre em Contato">
            <Paragraph>
              Para dúvidas, solicitações ou preocupações sobre esta Política de
              Privacidade ou sobre o tratamento de seus dados pessoais:
            </Paragraph>
            <div className="rounded-lg border-2 border-blue-100 bg-blue-50 p-6">
              <div className="mb-4">
                <p className="text-lg font-semibold text-gray-900">Bot Reserva</p>
                <p className="text-sm text-gray-600">
                  Sistema CRM WhatsApp para Hotéis
                </p>
              </div>
              <List>
                <ListItem>
                  <Strong>E-mail:</Strong>{' '}
                  <a
                    href="mailto:contato@botreserva.com.br"
                    className="text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    contato@botreserva.com.br
                  </a>
                </ListItem>
                <ListItem>
                  <Strong>Website:</Strong>{' '}
                  <a
                    href="https://www.botreserva.com.br"
                    className="text-blue-600 hover:text-blue-800 hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    www.botreserva.com.br
                  </a>
                </ListItem>
                <ListItem>
                  <Strong>Horário de atendimento:</Strong> Segunda a sexta, 9h às 18h
                  (horário de Brasília)
                </ListItem>
              </List>
            </div>
          </Section>

          {/* Consentimento */}
          <Section title="15. Consentimento">
            <Paragraph>
              Ao utilizar nossos serviços através do WhatsApp, você reconhece que leu,
              compreendeu e concordou com os termos desta Política de Privacidade.
            </Paragraph>
            <Paragraph>
              Se você não concordar com qualquer parte desta política, por favor, não
              utilize nossos serviços.
            </Paragraph>
          </Section>
        </article>

        {/* Footer */}
        <footer className="mt-12 border-t border-gray-200 pt-8 text-center text-sm text-gray-500">
          <p>
            Copyright {new Date().getFullYear()} Bot Reserva. Todos os direitos
            reservados.
          </p>
          <p className="mt-2">
            Este documento está em conformidade com a LGPD (Lei 13.709/2018) e as
            diretrizes do WhatsApp Business API.
          </p>
        </footer>
      </div>
    </div>
  );
}
