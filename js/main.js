/**
 * ============================================================================
 * SisCAN - SISTEMA DE GESTÃO DE EMBARQUE
 * Aplicação Frontend — Integração Supabase + UI Logic
 * ============================================================================
 */

// ===== MÓDULO PRINCIPAL =====
const SisCAN = (() => {
    // ===== INICIALIZAÇÃO DO SUPABASE =====
    const supabaseUrl = 'https://slndtvffmpjrfbfqhnld.supabase.co';
    const supabaseKey = 'sb_publishable_SAGHfhAc4_dehQHWSkqshg_14T0M656';
    const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

    // --- Estado da aplicação ---
    let currentSection = 'dashboard';
    let currentUser = null;

    // --- Cache de referências DOM ---
    const DOM = {
        loginScreen: () => document.getElementById('login-screen'),
        app: () => document.getElementById('app-workspace'),
        mainNav: () => document.getElementById('main-navbar'),
        loginForm: () => document.getElementById('login-form'),
        sidebar: () => document.getElementById('main-sidebar'),
        sidebarToggle: () => document.getElementById('sidebar-toggle'),
        pageTitle: () => document.getElementById('page-title'),
        breadcrumb: () => document.getElementById('breadcrumb-current'),
        userName: () => document.getElementById('sidebar-user-name'),
        userRole: () => document.getElementById('sidebar-user-role'),
        modalOverlay: () => document.getElementById('modal-overlay'),
        modalTitle: () => document.getElementById('modal-title'),
        modalBody: () => document.getElementById('modal-body'),
        modalConfirm: () => document.getElementById('modal-confirm'),
        toastContainer: () => document.getElementById('toast-container'),
    };

    // --- Títulos das seções ---
    const sectionTitles = {
        dashboard: { title: 'Dashboard', breadcrumb: 'Visão Geral' },
        voos: { title: 'Gestão de Voos', breadcrumb: 'Voos' },
        passageiros: { title: 'Passageiros', breadcrumb: 'Cadastro' },
        inscricoes: { title: 'Inscrições', breadcrumb: 'Manifesto' },
        logs: { title: 'Auditoria', breadcrumb: 'Logs' },
    };

    // =====================================================================
    // INICIALIZAÇÃO
    // =====================================================================
    function init() {
        setupLogin();
        setupSidebar();
        setupModal();
        setupClock();
        setupParticles();
        setupFormButtons();
    }

    // =====================================================================
    // LOGIN
    // =====================================================================
    function setupLogin() {
        // Verifica se há sessão ativa
        const savedUser = sessionStorage.getItem('siscan_user');
        if (savedUser) {
            try {
                currentUser = JSON.parse(savedUser);
                DOM.userName().textContent = currentUser.nome;
                DOM.userRole().textContent = currentUser.perfil || 'admin';
                DOM.loginScreen().classList.add('hidden');
                DOM.app().classList.remove('hidden');
                if (DOM.mainNav()) DOM.mainNav().classList.remove('hidden');
                loadDashboardData();
                loadAdmins();
            } catch (e) {
                sessionStorage.removeItem('siscan_user');
            }
        }

        DOM.loginForm().addEventListener('submit', async (e) => {
            e.preventDefault();
            const nome = document.getElementById('login-nome').value.trim();
            const senha = document.getElementById('login-senha').value.trim();

            if (!nome || !senha) {
                showToast('Preencha todos os campos.', 'warning');
                return;
            }

            // Autenticação simples (busca na tabela usuarios_admin)
            // Em produção, integrar com Supabase Auth
            const { data, error } = await supabase
                .from('usuarios_admin')
                .select('*')
                .eq('nome', nome)
                .single();

            if (error || !data) {
                showToast('Usuário não encontrado. Digite o nome completo.', 'error');
                return;
            }

            if (data.senha && data.senha !== senha) {
                showToast('Senha incorreta.', 'error');
                return;
            }

            currentUser = data;

            // Salva na sessão
            sessionStorage.setItem('siscan_user', JSON.stringify(currentUser));

            DOM.userName().textContent = currentUser.nome;
            DOM.userRole().textContent = currentUser.perfil;

            // Transição de tela
            DOM.loginScreen().classList.add('hidden');
            DOM.app().classList.remove('hidden');
            if (DOM.mainNav()) DOM.mainNav().classList.remove('hidden');
            loadDashboardData();
            loadAdmins();
        });

        document.getElementById('btn-logout').addEventListener('click', () => {
            currentUser = null;
            sessionStorage.removeItem('siscan_user');
            DOM.app().classList.add('hidden');
            if (DOM.mainNav()) DOM.mainNav().classList.add('hidden');
            DOM.loginScreen().classList.remove('hidden');
            document.getElementById('login-nome').value = '';
            document.getElementById('login-senha').value = '';
            showToast('Sessão encerrada com sucesso.', 'info');
        });
    }

    // =====================================================================
    // SIDEBAR & NAVEGAÇÃO
    // =====================================================================
    function setupSidebar() {
        if (DOM.sidebarToggle()) {
            DOM.sidebarToggle().addEventListener('click', () => {
                DOM.sidebar().classList.toggle('collapsed');
            });
        }
    }

    function navigateTo(sectionId) {
        currentSection = sectionId;

        // Atualizar seções visíveis
        const allSections = document.querySelectorAll('section');
        allSections.forEach(s => {
            if (s.id.startsWith('tela-')) s.classList.add('hidden');
        });
        const target = document.getElementById(sectionId);
        if (target) target.classList.remove('hidden');

        const rawSection = sectionId.replace('tela-', '');
        
        // Atualizar links ativos
        document.querySelectorAll('nav button').forEach(btn => {
            btn.classList.remove('bg-primary-container', 'text-pure-white', 'shadow-md');
            btn.classList.add('text-on-surface-variant', 'hover:bg-surface-container-high', 'hover:text-on-surface');
        });
        
        const activeBtn = document.getElementById(`nav-btn-${rawSection}`);
        if (activeBtn) {
            activeBtn.classList.add('bg-primary-container', 'text-pure-white', 'shadow-md');
            activeBtn.classList.remove('text-on-surface-variant', 'hover:bg-surface-container-high', 'hover:text-on-surface');
        }

        // Carregar dados da seção
        loadSectionData(rawSection);
    }

    // =====================================================================
    // CARREGAMENTO DE DADOS (SUPABASE)
    // =====================================================================
    async function loadSectionData(section) {
        switch (section) {
            case 'dashboard': await loadDashboardData(); break;
            case 'voos': await loadVoos(); break;
            case 'passageiros': await loadPassageiros(); break;
            case 'inscricoes': await loadInscricoes(); break;
            case 'aeronaves': await loadAeronaves(); break;
            case 'logs': await loadLogs(); break;
            case 'admins': await loadAdmins(); break;
        }
    }

    async function loadDashboardData() {
        try {
            const [voos, passageiros, inscricoes] = await Promise.all([
                supabase.from('voos').select('*', { count: 'exact' }).eq('status', 'agendado'),
                supabase.from('passageiros').select('*', { count: 'exact' }),
                supabase.from('inscricoes').select('*', { count: 'exact' }),
            ]);

            animateCounter('stat-voos', voos.count || 0);
            animateCounter('stat-passageiros', passageiros.count || 0);
            animateCounter('stat-inscricoes', inscricoes.count || 0);

            // No-shows
            const noshow = await supabase.from('inscricoes').select('*', { count: 'exact' }).eq('status', 'no-show');
            animateCounter('stat-noshow', noshow.count || 0);

            // Tabela de voos recentes no dashboard
            if (voos.data && voos.data.length > 0) {
                const tbody = document.getElementById('dashboard-voos-table');
                tbody.innerHTML = voos.data.slice(0, 5).map(v => `
                    <tr>
                        <td><strong>${v.destino}</strong></td>
                        <td>${v.aeronave_id}</td>
                        <td>${formatDate(v.data_horario)}</td>
                        <td>${v.vagas_totais}</td>
                        <td>${statusBadge(v.status, 'voo')}</td>
                    </tr>
                `).join('');
            }

            // Atividade recente (últimos logs)
            const logs = await supabase.from('logs_auditoria').select('*, usuarios_admin(nome)').order('criado_em', { ascending: false }).limit(8);
            if (logs.data && logs.data.length > 0) {
                const feed = document.getElementById('activity-feed');
                feed.innerHTML = logs.data.map(log => {
                    const dotColor = log.acao.includes('DELETE') ? 'red' : log.acao.includes('INSERT') ? 'green' : 'blue';
                    return `
                        <div class="activity-item">
                            <div class="activity-dot ${dotColor}"></div>
                            <div>
                                <div class="activity-text"><strong>${log.usuarios_admin?.nome || 'Sistema'}</strong> — ${log.acao}</div>
                                <div class="activity-time">${formatDate(log.criado_em)}</div>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        } catch (err) {
            console.warn('Dashboard: banco não disponível ou tabelas não criadas.', err);
        }
    }

    async function loadVoos() {
        const { data, error } = await supabase.from('voos').select('*').order('data_horario', { ascending: true });
        const tbody = document.getElementById('voos-table');
        if (error || !data || data.length === 0) {
            tbody.innerHTML = `<tr class="empty-row"><td colspan="6"><div class="empty-state-inline"><i class="fas fa-plane-slash"></i><span>Nenhum voo encontrado</span></div></td></tr>`;
            return;
        }
        tbody.innerHTML = data.map(v => `
            <tr>
                <td><strong>${v.destino}</strong></td>
                <td>${v.aeronave_id}</td>
                <td>${formatDate(v.data_horario)}</td>
                <td>${v.vagas_totais}</td>
                <td>${statusBadge(v.status, 'voo')}</td>
                <td>
                    <div class="action-btns">
                        <button class="btn btn-icon btn-ghost" onclick="SisCAN.editVoo('${v.id}')" title="Editar"><i class="fas fa-pen"></i></button>
                        <button class="btn btn-icon btn-danger" onclick="SisCAN.deleteVoo('${v.id}')" title="Excluir"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    async function loadAeronaves() {
        const { data, error } = await supabase.from('aeronaves').select('*').order('modelo');
        const tbody = document.getElementById('tbody-aeronaves');
        if (error || !data || data.length === 0) {
            tbody.innerHTML = `<tr class="empty-row"><td colspan="7"><div class="empty-state-inline"><i class="fas fa-plane-slash"></i><span>Nenhuma aeronave registrada na frota</span></div></td></tr>`;
            return;
        }
        tbody.innerHTML = data.map(a => `
            <tr>
                <td><strong>${a.modelo}</strong></td>
                <td><span class="badge" style="background:#061B40; border: 1px solid #1e2d4a;">${a.matricula_fab}</span></td>
                <td>${a.esquadrao || '—'} / ${a.base_operacional || '—'}</td>
                <td>${a.capacidade_pax} PAX</td>
                <td>${a.payload_max_kg || '—'} kg</td>
                <td>${statusBadge(a.status, 'aeronave')}</td>
                <td>
                    <div class="action-btns">
                        <button class="btn btn-icon btn-ghost" onclick="SisCAN.editAeronave('${a.id}')" title="Editar"><i class="fas fa-pen"></i></button>
                        <button class="btn btn-icon btn-danger" onclick="SisCAN.deleteAeronave('${a.id}')" title="Excluir"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    // =====================================================================
    // GESTÃO DE ADMINISTRADORES
    // =====================================================================
    async function loadAdmins() {
        const { data, error } = await supabase.from('usuarios_admin').select('*').order('criado_em', { ascending: false });
        const tbody = document.getElementById('tbody-admins');
        const badge = document.getElementById('total-admins-badge');
        
        if (!tbody) return;

        const metricCount = document.getElementById('metric-admins-count');

        if (error || !data || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center py-space-md text-cadet-gray">Nenhum administrador encontrado.</td></tr>`;
            if (badge) badge.textContent = `0 usuários`;
            if (metricCount) metricCount.textContent = '0';
            return;
        }

        if (badge) badge.textContent = `${data.length} usuário${data.length !== 1 ? 's' : ''}`;
        if (metricCount) metricCount.textContent = data.length.toString();

        const isRoot = currentUser && currentUser.perfil === 'root';
        const currentUserId = currentUser ? currentUser.id : null;

        tbody.innerHTML = data.map(admin => {
            const isSelf = admin.id === currentUserId;
            const canEdit = isRoot || isSelf;
            const canRevoke = isRoot && admin.perfil !== 'root';

            let actionButtons = '';

            if (canEdit) {
                actionButtons += `
                    <button class="px-space-sm py-1 rounded border border-gold-military/30 text-gold-military hover:bg-gold-military hover:text-surface transition-colors font-label-sm text-label-sm font-bold tracking-wider" onclick="editAdminProfile('${admin.id}')">
                        EDITAR PERFIL
                    </button>`;
            }

            if (canRevoke) {
                actionButtons += `
                    <button class="px-space-sm py-1 rounded border border-status-alert-red/30 text-status-alert-red hover:bg-status-alert-red hover:text-pure-white transition-colors font-label-sm text-label-sm font-bold tracking-wider" onclick="deleteAdmin('${admin.id}')">
                        REVOGAR
                    </button>`;
            }

            return `
            <tr class="hover:bg-surface-container-low/50 transition-colors group">
                <td class="py-space-sm px-space-md">
                    <div class="flex items-center gap-space-sm">
                        <div class="w-8 h-8 rounded-full bg-surface-container-high border border-surface-container-highest flex items-center justify-center shrink-0">
                            <span class="material-symbols-outlined text-[16px] text-cadet-gray">person</span>
                        </div>
                        <span class="font-bold text-pure-white">${admin.nome}</span>
                    </div>
                </td>
                <td class="py-space-sm px-space-md font-mono text-cadet-gray">${admin.email || 'N/A'}</td>
                <td class="py-space-sm px-space-md font-mono text-cadet-gray">${admin.saram || 'N/A'}</td>
                <td class="py-space-sm px-space-md text-cadet-gray">${admin.organizacao || 'N/A'}</td>
                <td class="py-space-sm px-space-md text-center">
                    <span class="px-space-sm py-0.5 rounded ${admin.perfil === 'root' ? 'bg-tertiary-container text-tertiary-fixed' : 'bg-surface-container-highest text-cadet-gray'} font-label-sm text-label-sm font-bold uppercase tracking-wider">
                        ${admin.perfil}
                    </span>
                </td>
                <td class="py-space-sm px-space-md text-right">
                    <div class="flex items-center justify-end gap-space-xs">
                        ${actionButtons}
                    </div>
                </td>
            </tr>`;
        }).join('');
    }

    async function deleteAdmin(id) {
        if (!confirm('Tem certeza que deseja revogar o acesso deste administrador?')) return;
        
        // Verifica se é o ROOT
        const { data: admin } = await supabase.from('usuarios_admin').select('perfil').eq('id', id).single();
        if (admin && admin.perfil === 'root') {
            showToast('Não é possível revogar o acesso de um usuário ROOT.', 'warning');
            return;
        }

        const { error } = await supabase.from('usuarios_admin').delete().eq('id', id);
        if (error) {
            showToast('Erro ao revogar acesso.', 'error');
        } else {
            showToast('Acesso revogado com sucesso.', 'success');
            await logAction('DELETE_ADMIN', { id });
            loadAdmins();
        }
    }

    async function changeAdminPassword(id) {
        // Verificação de permissão: root pode mudar qualquer senha, admin só a própria
        const isRoot = currentUser && currentUser.perfil === 'root';
        const isSelf = currentUser && currentUser.id === id;

        if (!isRoot && !isSelf) {
            showToast('Permissão negada. Apenas o ROOT pode alterar senhas de outros administradores.', 'warning');
            return;
        }

        const novaSenha = prompt('Digite a nova senha para este administrador:');
        if (!novaSenha) return;

        if (novaSenha.length < 4) {
            showToast('A senha deve ter pelo menos 4 caracteres.', 'warning');
            return;
        }

        try {
            const { error } = await supabase
                .from('usuarios_admin')
                .update({ senha: novaSenha })
                .eq('id', id);

            if (error) throw error;
            showToast('Senha atualizada com sucesso!', 'success');
            await logAction('CHANGE_ADMIN_PASSWORD', { id, executado_por: currentUser.nome });
        } catch (error) {
            console.error('Erro ao mudar senha:', error);
            showToast('Erro ao atualizar a senha.', 'error');
        }
    }

    async function editAdminProfile(id) {
        // Verificação de permissão: root pode editar qualquer perfil, admin só o próprio
        const isRoot = currentUser && currentUser.perfil === 'root';
        const isSelf = currentUser && currentUser.id === id;

        if (!isRoot && !isSelf) {
            showToast('Permissão negada. Você só pode editar o seu próprio perfil.', 'warning');
            return;
        }

        // Buscar dados atuais do admin
        const { data: admin, error: fetchError } = await supabase
            .from('usuarios_admin')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !admin) {
            showToast('Erro ao buscar dados do administrador.', 'error');
            return;
        }

        const editLabel = isRoot && !isSelf
            ? `Editando perfil completo de: <strong class="text-gold-military">${admin.nome}</strong>`
            : 'Editando seu próprio perfil';

        // ROOT edita tudo, admin comum edita só nome e senha
        const extraFieldsHTML = isRoot ? `
                <div class="grid grid-cols-2 gap-space-sm">
                    <div class="form-group">
                        <label class="block font-label-sm text-label-sm text-cadet-gray uppercase tracking-wider mb-1 font-bold">E-mail Institucional</label>
                        <input type="email" id="edit-admin-email" value="${admin.email || ''}" 
                            class="w-full text-body-md px-3 py-2 bg-surface border border-surface-container-high text-pure-white rounded focus:border-primary focus:ring-1 focus:ring-primary outline-none placeholder-cadet-gray font-mono"
                            placeholder="email@fab.mil.br">
                    </div>
                    <div class="form-group">
                        <label class="block font-label-sm text-label-sm text-cadet-gray uppercase tracking-wider mb-1 font-bold">SARAM / Matrícula</label>
                        <input type="text" id="edit-admin-saram" value="${admin.saram || ''}" 
                            class="w-full text-body-md px-3 py-2 bg-surface border border-surface-container-high text-pure-white rounded focus:border-primary focus:ring-1 focus:ring-primary outline-none placeholder-cadet-gray font-mono"
                            placeholder="6849120" inputmode="numeric" oninput="this.value = this.value.replace(/\\D/g, '')">
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-space-sm mt-space-sm">
                    <div class="form-group">
                        <label class="block font-label-sm text-label-sm text-cadet-gray uppercase tracking-wider mb-1 font-bold">Base / Organização Militar</label>
                        <input type="text" id="edit-admin-om" value="${admin.organizacao || ''}" 
                            class="w-full text-body-md px-3 py-2 bg-surface border border-surface-container-high text-pure-white rounded focus:border-primary focus:ring-1 focus:ring-primary outline-none placeholder-cadet-gray"
                            placeholder="BABR - Base Aérea de Brasília">
                    </div>
                    <div class="form-group">
                        <label class="block font-label-sm text-label-sm text-cadet-gray uppercase tracking-wider mb-1 font-bold">Nível / Perfil</label>
                        <select id="edit-admin-perfil" class="w-full text-body-md px-3 py-2 bg-surface border border-surface-container-high text-pure-white rounded focus:border-primary focus:ring-1 focus:ring-primary outline-none">
                            <option value="admin" ${admin.perfil === 'admin' ? 'selected' : ''}>ADMIN</option>
                            <option value="root" ${admin.perfil === 'root' ? 'selected' : ''}>ROOT</option>
                        </select>
                    </div>
                </div>` : '';

        DOM.modalTitle().textContent = isRoot ? 'Editar Perfil Completo' : 'Editar Meu Perfil';
        DOM.modalBody().innerHTML = `
            <div class="mb-space-md p-space-sm rounded bg-surface-container border border-surface-container-high">
                <div class="flex items-center gap-space-sm">
                    <span class="material-symbols-outlined text-gold-military text-[20px]">edit_note</span>
                    <span class="font-body-md text-body-md text-on-surface">${editLabel}</span>
                </div>
            </div>
            ${isRoot ? `<div class="mb-space-md p-space-xs rounded bg-tertiary-container/30 border border-tertiary/20">
                <div class="flex items-center gap-space-xs px-space-xs">
                    <span class="material-symbols-outlined text-tertiary text-[16px]">shield</span>
                    <span class="font-label-sm text-label-sm text-tertiary uppercase tracking-wider font-bold">Modo ROOT — Edição completa habilitada</span>
                </div>
            </div>` : ''}
            <div class="space-y-space-md">
                <div class="form-group">
                    <label class="block font-label-sm text-label-sm text-cadet-gray uppercase tracking-wider mb-1 font-bold">Nome Completo</label>
                    <input type="text" id="edit-admin-nome" value="${admin.nome}" 
                        class="w-full text-body-md px-3 py-2 bg-surface border border-surface-container-high text-pure-white rounded focus:border-primary focus:ring-1 focus:ring-primary outline-none placeholder-cadet-gray"
                        placeholder="Nome do administrador" required>
                </div>
                ${extraFieldsHTML}
                <div class="border-t border-surface-container-high pt-space-md mt-space-md">
                    <div class="flex items-center gap-space-xs mb-space-sm">
                        <span class="material-symbols-outlined text-cadet-gray text-[16px]">lock_reset</span>
                        <span class="font-label-sm text-label-sm text-cadet-gray uppercase tracking-wider font-bold">Alteração de Senha</span>
                        <span class="font-label-sm text-[10px] text-cadet-gray">(opcional — deixe em branco para manter)</span>
                    </div>
                    <div class="grid grid-cols-2 gap-space-sm">
                        <div class="form-group">
                            <label class="block font-label-sm text-label-sm text-cadet-gray uppercase tracking-wider mb-1 font-bold">Nova Senha</label>
                            <input type="password" id="edit-admin-senha" value="" 
                                class="w-full text-body-md px-3 py-2 bg-surface border border-surface-container-high text-pure-white rounded focus:border-primary focus:ring-1 focus:ring-primary outline-none placeholder-cadet-gray font-mono"
                                placeholder="••••••••">
                        </div>
                        <div class="form-group">
                            <label class="block font-label-sm text-label-sm text-cadet-gray uppercase tracking-wider mb-1 font-bold">Confirmar Senha</label>
                            <input type="password" id="edit-admin-senha-confirm" value="" 
                                class="w-full text-body-md px-3 py-2 bg-surface border border-surface-container-high text-pure-white rounded focus:border-primary focus:ring-1 focus:ring-primary outline-none placeholder-cadet-gray font-mono"
                                placeholder="••••••••">
                        </div>
                    </div>
                </div>
            </div>
        `;

        showModal(async () => {
            const novoNome = document.getElementById('edit-admin-nome').value.trim();
            const novaSenha = document.getElementById('edit-admin-senha').value.trim();
            const confirmSenha = document.getElementById('edit-admin-senha-confirm').value.trim();

            if (!novoNome) {
                showToast('O nome não pode ficar em branco.', 'warning');
                return;
            }

            // Se preencheu senha, validar
            if (novaSenha) {
                if (novaSenha.length < 4) {
                    showToast('A senha deve ter pelo menos 4 caracteres.', 'warning');
                    return;
                }
                if (novaSenha !== confirmSenha) {
                    showToast('As senhas não coincidem. Verifique e tente novamente.', 'warning');
                    return;
                }
            }

            // Montar payload de update
            const updatePayload = { nome: novoNome };
            if (novaSenha) {
                updatePayload.senha = novaSenha;
            }

            // Se ROOT, incluir campos extras
            let isTransferringRoot = false;
            if (isRoot) {
                const emailEl = document.getElementById('edit-admin-email');
                const saramEl = document.getElementById('edit-admin-saram');
                const omEl = document.getElementById('edit-admin-om');
                const perfilEl = document.getElementById('edit-admin-perfil');
                
                if (emailEl) updatePayload.email = emailEl.value.trim() || null;
                if (saramEl) updatePayload.saram = saramEl.value.trim() || null;
                if (omEl) updatePayload.organizacao = omEl.value.trim() || null;
                
                if (perfilEl) {
                    const newPerfil = perfilEl.value;
                    if (newPerfil === 'root' && admin.perfil !== 'root') {
                        isTransferringRoot = true;
                        updatePayload.perfil = 'root';
                    } else if (newPerfil === 'admin' && admin.perfil === 'root') {
                        showToast('Você não pode remover o ROOT de si mesmo. Para sair do cargo, transfira o ROOT editando o perfil de outro usuário.', 'warning');
                        return;
                    }
                }
            }

            try {
                if (isTransferringRoot) {
                    // Rebaixar o root atual (usuário logado) para admin
                    const { error: demoteError } = await supabase
                        .from('usuarios_admin')
                        .update({ perfil: 'admin' })
                        .eq('id', currentUser.id);
                    if (demoteError) throw demoteError;
                }

                const { error } = await supabase
                    .from('usuarios_admin')
                    .update(updatePayload)
                    .eq('id', id);

                if (error) throw error;

                // Atualizar sessão se o admin editou a si mesmo
                if (isSelf) {
                    currentUser.nome = novoNome;
                    if (updatePayload.email !== undefined) currentUser.email = updatePayload.email;
                    if (updatePayload.saram !== undefined) currentUser.saram = updatePayload.saram;
                    if (updatePayload.organizacao !== undefined) currentUser.organizacao = updatePayload.organizacao;
                    sessionStorage.setItem('siscan_user', JSON.stringify(currentUser));
                    DOM.userName().textContent = novoNome;
                }

                const logDetails = {
                    id,
                    nome_anterior: admin.nome,
                    nome_novo: novoNome,
                    campos_alterados: Object.keys(updatePayload).filter(k => k !== 'senha'),
                    senha_alterada: !!novaSenha,
                    executado_por: currentUser.nome,
                };

                if (isTransferringRoot) {
                    currentUser.perfil = 'admin';
                    sessionStorage.setItem('siscan_user', JSON.stringify(currentUser));
                    DOM.userRole().textContent = 'admin';
                    showToast('Perfil atualizado. Privilégios de ROOT transferidos com sucesso!', 'success');
                } else {
                    showToast('Perfil atualizado com sucesso!', 'success');
                }
                
                await logAction('EDIT_ADMIN_PROFILE', logDetails);
                hideModal();
                loadAdmins();
            } catch (err) {
                console.error('Erro ao atualizar perfil:', err);
                showToast('Erro ao atualizar perfil do administrador.', 'error');
            }
        });
    }

    async function loadPassageiros() {
        const { data, error } = await supabase.from('passageiros').select('*').order('nome_completo');
        const listContainer = document.getElementById('lista-passageiros-lateral');
        const badge = document.getElementById('badge-total-pax');
        
        if (error || !data || data.length === 0) {
            if (listContainer) {
                listContainer.innerHTML = `
                    <div class="p-space-md text-cadet-gray text-center font-body-md text-sm flex flex-col items-center justify-center h-full">
                        <span class="material-symbols-outlined text-4xl mb-2 opacity-50">group_off</span>
                        <span>Nenhum passageiro cadastrado</span>
                    </div>`;
            }
            if (badge) badge.textContent = `-- Cadastrados`;
            return;
        }

        if (badge) badge.textContent = `${data.length.toString().padStart(2, '0')} Cadastrados`;

        if (listContainer) {
            listContainer.innerHTML = data.map(p => `
                <div class="p-space-sm hover:bg-surface-container-highest transition-colors cursor-pointer group flex items-center justify-between" onclick="SisCAN.editPassageiro('${p.id}')">
                    <div class="flex items-center gap-space-sm overflow-hidden">
                        <div class="w-8 h-8 rounded-full bg-primary-container text-pure-white flex items-center justify-center font-bold text-[12px] shrink-0 border border-primary/30">
                            ${p.nome_completo.substring(0, 2).toUpperCase()}
                        </div>
                        <div class="min-w-0">
                            <p class="font-body-md text-sm font-bold text-pure-white truncate" title="${p.nome_completo}">${p.nome_completo}</p>
                            <div class="flex items-center gap-2 mt-0.5 text-[11px] text-cadet-gray">
                                <span class="font-code-flight">${formatCPF(p.cpf)}</span>
                                <span>•</span>
                                <span class="truncate">${p.posto_graduacao || '—'}</span>
                            </div>
                        </div>
                    </div>
                    <div class="opacity-0 group-hover:opacity-100 transition-opacity">
                        <button class="w-7 h-7 flex items-center justify-center rounded text-pure-white bg-status-danger hover:bg-status-danger/80 transition-colors" onclick="event.stopPropagation(); SisCAN.deletePassageiro('${p.id}')" title="Excluir">
                            <span class="material-symbols-outlined text-[14px]">delete</span>
                        </button>
                    </div>
                </div>
            `).join('');
        }
    }

    async function loadInscricoes() {
        const { data, error } = await supabase
            .from('inscricoes')
            .select('*, passageiros(nome_completo), voos(destino)')
            .order('prioridade_ranking');
        const tbody = document.getElementById('inscricoes-table');
        if (error || !data || data.length === 0) {
            tbody.innerHTML = `<tr class="empty-row"><td colspan="5"><div class="empty-state-inline"><i class="fas fa-clipboard"></i><span>Nenhuma inscrição encontrada</span></div></td></tr>`;
            return;
        }
        tbody.innerHTML = data.map(i => `
            <tr>
                <td><strong>${i.passageiros?.nome_completo || '—'}</strong></td>
                <td>${i.voos?.destino || '—'}</td>
                <td>${statusBadge(i.status, 'inscricao')}</td>
                <td>#${i.prioridade_ranking}</td>
                <td>
                    <div class="action-btns">
                        <button class="btn btn-icon btn-ghost" onclick="SisCAN.editInscricao('${i.id}')" title="Editar"><i class="fas fa-pen"></i></button>
                        <button class="btn btn-icon btn-danger" onclick="SisCAN.deleteInscricao('${i.id}')" title="Excluir"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    async function loadLogs() {
        const { data, error } = await supabase
            .from('logs_auditoria')
            .select('*, usuarios_admin(nome)')
            .order('criado_em', { ascending: false });
        const tbody = document.getElementById('logs-table');
        if (error || !data || data.length === 0) {
            tbody.innerHTML = `<tr class="empty-row"><td colspan="4"><div class="empty-state-inline"><i class="fas fa-scroll"></i><span>Nenhum registro de auditoria</span></div></td></tr>`;
            return;
        }
        tbody.innerHTML = data.map(l => `
            <tr>
                <td>${formatDate(l.criado_em)}</td>
                <td>${l.usuarios_admin?.nome || '—'}</td>
                <td><span class="badge badge-blue">${l.acao}</span></td>
                <td>${l.detalhes ? JSON.stringify(l.detalhes) : '—'}</td>
            </tr>
        `).join('');
    }

    // =====================================================================
    // FORMULÁRIOS (MODAIS)
    // =====================================================================
    function setupFormButtons() {
        document.getElementById('btn-novo-voo')?.addEventListener('click', () => openVooModal());
        document.getElementById('btn-novo-passageiro')?.addEventListener('click', () => openPassageiroModal());
        document.getElementById('btn-nova-inscricao')?.addEventListener('click', () => openInscricaoModal());
    }

    function openVooModal(voo = null) {
        DOM.modalTitle().textContent = voo ? 'Editar Voo' : 'Novo Voo';
        DOM.modalBody().innerHTML = `
            <div class="form-group">
                <label>Destino</label>
                <input type="text" id="form-destino" value="${voo?.destino || ''}" placeholder="Ex: Brasília (SBBR)" required>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Aeronave</label>
                    <input type="text" id="form-aeronave" value="${voo?.aeronave_id || ''}" placeholder="Ex: C-105 Amazonas">
                </div>
                <div class="form-group">
                    <label>Vagas Totais</label>
                    <input type="number" id="form-vagas" value="${voo?.vagas_totais || ''}" min="1" placeholder="Ex: 30">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Data/Hora</label>
                    <input type="datetime-local" id="form-data-horario" value="${voo?.data_horario ? voo.data_horario.slice(0, 16) : ''}">
                </div>
                <div class="form-group">
                    <label>Status</label>
                    <select id="form-status-voo">
                        <option value="agendado" ${voo?.status === 'agendado' ? 'selected' : ''}>Agendado</option>
                        <option value="embarcando" ${voo?.status === 'embarcando' ? 'selected' : ''}>Embarcando</option>
                        <option value="concluido" ${voo?.status === 'concluido' ? 'selected' : ''}>Concluído</option>
                        <option value="cancelado" ${voo?.status === 'cancelado' ? 'selected' : ''}>Cancelado</option>
                    </select>
                </div>
            </div>
        `;
        showModal(async () => {
            const payload = {
                destino: document.getElementById('form-destino').value,
                aeronave_id: document.getElementById('form-aeronave').value,
                vagas_totais: parseInt(document.getElementById('form-vagas').value),
                data_horario: document.getElementById('form-data-horario').value,
                status: document.getElementById('form-status-voo').value,
            };
            if (voo) {
                const { error } = await supabase.from('voos').update(payload).eq('id', voo.id);
                if (error) return showToast('Erro ao atualizar voo.', 'error');
                showToast('Voo atualizado com sucesso!', 'success');
            } else {
                const { error } = await supabase.from('voos').insert(payload);
                if (error) return showToast('Erro ao criar voo: ' + error.message, 'error');
                showToast('Voo criado com sucesso!', 'success');
            }
            await logAction(voo ? 'UPDATE_VOO' : 'INSERT_VOO', payload);
            hideModal();
            loadVoos();
            loadDashboardData();
        });
    }

    function openPassageiroModal(passageiro = null) {
        DOM.modalTitle().textContent = passageiro ? 'Editar Passageiro' : 'Novo Passageiro';
        DOM.modalBody().innerHTML = `
            <div class="form-group">
                <label>Nome Completo</label>
                <input type="text" id="form-nome" value="${passageiro?.nome_completo || ''}" placeholder="Nome completo" required>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>CPF (somente números)</label>
                    <input type="text" id="form-cpf" value="${passageiro?.cpf || ''}" maxlength="11" placeholder="00000000000">
                </div>
                <div class="form-group">
                    <label>SARAM</label>
                    <input type="text" id="form-saram" value="${passageiro?.saram || ''}" placeholder="Opcional">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Posto/Graduação</label>
                    <input type="text" id="form-posto" value="${passageiro?.posto_graduacao || ''}" placeholder="Ex: Capitão">
                </div>
                <div class="form-group">
                    <label>Peso (kg)</label>
                    <input type="number" id="form-peso" value="${passageiro?.peso_kg || ''}" step="0.1" min="1" placeholder="80.5">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>E-mail</label>
                    <input type="email" id="form-email" value="${passageiro?.email || ''}" placeholder="email@fab.mil.br">
                </div>
                <div class="form-group">
                    <label>Telefone</label>
                    <input type="tel" id="form-telefone" value="${passageiro?.telefone || ''}" placeholder="(61) 99999-0000">
                </div>
            </div>
        `;
        showModal(async () => {
            const payload = {
                nome_completo: document.getElementById('form-nome').value,
                cpf: document.getElementById('form-cpf').value,
                saram: document.getElementById('form-saram').value || null,
                posto_graduacao: document.getElementById('form-posto').value || null,
                peso_kg: parseFloat(document.getElementById('form-peso').value),
                email: document.getElementById('form-email').value,
                telefone: document.getElementById('form-telefone').value,
            };
            if (passageiro) {
                const { error } = await supabase.from('passageiros').update(payload).eq('id', passageiro.id);
                if (error) return showToast('Erro ao atualizar passageiro.', 'error');
                showToast('Passageiro atualizado!', 'success');
            } else {
                const { error } = await supabase.from('passageiros').insert(payload);
                if (error) return showToast('Erro ao cadastrar: ' + error.message, 'error');
                showToast('Passageiro cadastrado com sucesso!', 'success');
            }
            await logAction(passageiro ? 'UPDATE_PASSAGEIRO' : 'INSERT_PASSAGEIRO', { nome: payload.nome_completo });
            hideModal();
            loadPassageiros();
            loadDashboardData();
        });
    }

    async function openInscricaoModal() {
        // Buscar listas para selects
        const [voosRes, passRes] = await Promise.all([
            supabase.from('voos').select('id, destino').eq('status', 'agendado'),
            supabase.from('passageiros').select('id, nome_completo'),
        ]);

        const voosOptions = (voosRes.data || []).map(v => `<option value="${v.id}">${v.destino}</option>`).join('');
        const passOptions = (passRes.data || []).map(p => `<option value="${p.id}">${p.nome_completo}</option>`).join('');

        DOM.modalTitle().textContent = 'Nova Inscrição';
        DOM.modalBody().innerHTML = `
            <div class="form-group">
                <label>Voo</label>
                <select id="form-voo-id">${voosOptions || '<option disabled>Nenhum voo agendado</option>'}</select>
            </div>
            <div class="form-group">
                <label>Passageiro</label>
                <select id="form-passageiro-id">${passOptions || '<option disabled>Nenhum passageiro cadastrado</option>'}</select>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Status</label>
                    <select id="form-status-inscricao">
                        <option value="titular">Titular</option>
                        <option value="reserva" selected>Reserva</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Prioridade</label>
                    <input type="number" id="form-prioridade" value="999" min="1" placeholder="1 = maior prioridade">
                </div>
            </div>
        `;
        showModal(async () => {
            const payload = {
                voo_id: document.getElementById('form-voo-id').value,
                passageiro_id: document.getElementById('form-passageiro-id').value,
                status: document.getElementById('form-status-inscricao').value,
                prioridade_ranking: parseInt(document.getElementById('form-prioridade').value),
            };
            const { error } = await supabase.from('inscricoes').insert(payload);
            if (error) return showToast('Erro ao inscrever: ' + error.message, 'error');
            showToast('Inscrição realizada com sucesso!', 'success');
            await logAction('INSERT_INSCRICAO', payload);
            hideModal();
            loadInscricoes();
            loadDashboardData();
        });
    }

    // --- AERONAVES MODALS ---
    function abrirModalAeronave(id = null) {
        DOM.modalTitle().textContent = id ? 'Editar Vetor Aéreo' : 'Registrar Novo Vetor no SisCAN';
        
        DOM.modalBody().innerHTML = `
            <form id="form-aeronave" class="form-grid">
                <div class="form-group">
                    <label>Modelo da Aeronave *</label>
                    <input type="text" id="aero-modelo" placeholder="Ex: KC-390 Millennium" required>
                </div>
                <div class="form-group">
                    <label>Matrícula FAB *</label>
                    <input type="text" id="aero-matricula" placeholder="Ex: FAB 2855" required>
                </div>
                <div class="form-group">
                    <label>Esquadrão Responsável</label>
                    <input type="text" id="aero-esquadrao" placeholder="Ex: 1º GTT - Esquadrão Zeus">
                </div>
                <div class="form-group">
                    <label>Base Operacional</label>
                    <input type="text" id="aero-base" placeholder="Ex: SBBR (Brasília)">
                </div>
                <div class="form-group">
                    <label>Capacidade Assentos PAX *</label>
                    <input type="number" id="aero-capacidade" min="1" required>
                </div>
                <div class="form-group">
                    <label>Payload Máximo (KG)</label>
                    <input type="number" step="0.1" id="aero-payload">
                </div>
                <div class="form-group">
                    <label>Status Operacional</label>
                    <select id="aero-status" class="form-control" style="background-color: var(--bg-input); color: white; border: 1px solid var(--border-color); padding: 0.5rem; border-radius: var(--radius-sm); width: 100%;">
                        <option value="pronto">Pronto para Voo</option>
                        <option value="manutencao">Manutenção Programada</option>
                        <option value="inoperante">Inoperante (AOG)</option>
                    </select>
                </div>
            </form>
        `;

        if (id) {
            supabase.from('aeronaves').select('*').eq('id', id).single().then(({data}) => {
                if(data) {
                    document.getElementById('aero-modelo').value = data.modelo;
                    document.getElementById('aero-matricula').value = data.matricula_fab;
                    document.getElementById('aero-esquadrao').value = data.esquadrao || '';
                    document.getElementById('aero-base').value = data.base_operacional || '';
                    document.getElementById('aero-capacidade').value = data.capacidade_pax;
                    document.getElementById('aero-payload').value = data.payload_max_kg || '';
                    document.getElementById('aero-status').value = data.status;
                }
            });
        }
        
        showModal(async () => {
            const payload = {
                modelo: document.getElementById('aero-modelo').value.trim(),
                matricula_fab: document.getElementById('aero-matricula').value.trim(),
                esquadrao: document.getElementById('aero-esquadrao').value.trim() || null,
                base_operacional: document.getElementById('aero-base').value.trim() || null,
                capacidade_pax: parseInt(document.getElementById('aero-capacidade').value),
                payload_max_kg: parseFloat(document.getElementById('aero-payload').value) || null,
                status: document.getElementById('aero-status').value,
            };

            if (!payload.modelo || !payload.matricula_fab || !payload.capacidade_pax) {
                showToast('Preencha os campos obrigatórios (*)', 'error');
                return;
            }

            let res;
            if (id) {
                res = await supabase.from('aeronaves').update(payload).eq('id', id);
            } else {
                res = await supabase.from('aeronaves').insert([payload]);
            }

            if (res.error) {
                showToast('Erro ao salvar aeronave. Matrícula já existe?', 'error');
                return;
            }
            showToast(`Aeronave ${id ? 'atualizada' : 'registrada'} com sucesso!`);
            await logAction(id ? 'UPDATE_AERONAVE' : 'INSERT_AERONAVE', { matricula: payload.matricula_fab });
            hideModal();
            loadAeronaves();
        });
    }

    async function deleteAeronave(id) {
        if (!confirm('ATENÇÃO: Deseja realmente excluir este vetor?')) return;
        const { error } = await supabase.from('aeronaves').delete().eq('id', id);
        if (error) {
            if (error.code === '23503') showToast('Não é possível excluir aeronave com voos registrados.', 'error');
            else showToast('Erro ao excluir aeronave.', 'error');
            return;
        }
        showToast('Vetor aéreo excluído.', 'info');
        loadAeronaves();
        await logAction('DELETE_AERONAVE', { id });
    }

    // =====================================================================
    // OPERAÇÕES CRUD (EDIT/DELETE)
    // =====================================================================
    async function editVoo(id) {
        const { data } = await supabase.from('voos').select('*').eq('id', id).single();
        if (data) openVooModal(data);
    }

    async function deleteVoo(id) {
        if (!confirm('Tem certeza que deseja excluir este voo?')) return;
        const { error } = await supabase.from('voos').delete().eq('id', id);
        if (error) return showToast('Erro ao excluir voo.', 'error');
        showToast('Voo excluído.', 'success');
        await logAction('DELETE_VOO', { id });
        loadVoos();
        loadDashboardData();
    }

    async function editPassageiro(id) {
        const { data } = await supabase.from('passageiros').select('*').eq('id', id).single();
        if (data) openPassageiroModal(data);
    }

    async function deletePassageiro(id) {
        if (!confirm('Tem certeza que deseja excluir este passageiro?')) return;
        const { error } = await supabase.from('passageiros').delete().eq('id', id);
        if (error) return showToast('Erro ao excluir: ' + error.message, 'error');
        showToast('Passageiro excluído.', 'success');
        await logAction('DELETE_PASSAGEIRO', { id });
        loadPassageiros();
        loadDashboardData();
    }

    async function editInscricao(id) {
        // Simplificado: apenas altera o status
        const newStatus = prompt('Novo status (titular, reserva, no-show):');
        if (!newStatus || !['titular', 'reserva', 'no-show'].includes(newStatus)) return;
        const { error } = await supabase.from('inscricoes').update({ status: newStatus }).eq('id', id);
        if (error) return showToast('Erro ao atualizar inscrição.', 'error');
        showToast('Inscrição atualizada!', 'success');
        await logAction('UPDATE_INSCRICAO', { id, status: newStatus });
        loadInscricoes();
        loadDashboardData();
    }

    async function deleteInscricao(id) {
        if (!confirm('Tem certeza que deseja cancelar esta inscrição?')) return;
        const { error } = await supabase.from('inscricoes').delete().eq('id', id);
        if (error) return showToast('Erro ao excluir inscrição.', 'error');
        showToast('Inscrição removida.', 'success');
        await logAction('DELETE_INSCRICAO', { id });
        loadInscricoes();
        loadDashboardData();
    }

    // =====================================================================
    // AUDITORIA (LOG)
    // =====================================================================
    async function logAction(acao, detalhes) {
        try {
            if (!currentUser) return;
            // Buscar ID do usuário admin (se existir no banco)
            const { data } = await supabase
                .from('usuarios_admin')
                .select('id')
                .eq('nome', currentUser.nome)
                .single();

            if (data) {
                await supabase.from('logs_auditoria').insert({
                    usuario_id: data.id,
                    acao,
                    detalhes,
                });
            }
        } catch (err) {
            console.warn('Log de auditoria não registrado:', err);
        }
    }

    // =====================================================================
    // MODAL
    // =====================================================================
    let modalCallback = null;

    function setupModal() {
        document.getElementById('modal-close').addEventListener('click', hideModal);
        document.getElementById('modal-cancel').addEventListener('click', hideModal);
        DOM.modalConfirm().addEventListener('click', () => {
            if (modalCallback) modalCallback();
        });
        DOM.modalOverlay().addEventListener('click', (e) => {
            if (e.target === DOM.modalOverlay()) hideModal();
        });
    }

    function showModal(onConfirm) {
        modalCallback = onConfirm;
        DOM.modalOverlay().classList.remove('hidden');
        DOM.modalOverlay().classList.add('visible');
    }

    function hideModal() {
        DOM.modalOverlay().classList.remove('visible');
        setTimeout(() => {
            DOM.modalOverlay().classList.add('hidden');
        }, 300);
        modalCallback = null;
    }

    // =====================================================================
    // TOAST NOTIFICATIONS
    // =====================================================================
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        
        let bg = 'bg-surface-container-high';
        let icon = 'info';
        let color = 'text-pure-white';
        
        if (type === 'success') { bg = 'bg-status-operational-green'; icon = 'check_circle'; }
        else if (type === 'error' || type === 'danger') { bg = 'bg-status-alert-red'; icon = 'error'; }
        else if (type === 'warning') { bg = 'bg-gold-military'; icon = 'warning'; color = 'text-surface'; }

        toast.className = `flex items-center gap-2 px-4 py-3 rounded shadow-lg transition-opacity duration-300 ${bg} ${color}`;
        toast.innerHTML = `<span class="material-symbols-outlined text-[18px]">${icon}</span><span class="font-label-sm">${message}</span>`;
        
        const container = DOM.toastContainer();
        if (container) {
            container.appendChild(toast);
            setTimeout(() => {
                toast.classList.add('opacity-0');
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        }
    }

    // =====================================================================
    // UTILITÁRIOS
    // =====================================================================
    function formatDate(dateStr) {
        if (!dateStr) return '—';
        const d = new Date(dateStr);
        return d.toLocaleDateString('pt-BR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });
    }

    function formatCPF(cpf) {
        if (!cpf || cpf.length !== 11) return cpf || '—';
        return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }

    function statusBadge(status, tipo) {
        const map = {
            voo: {
                agendado: ['badge-blue', 'Agendado'],
                embarcando: ['badge-green', 'Embarcando'],
                concluido: ['badge-amber', 'Concluído'],
                cancelado: ['badge-red', 'Cancelado'],
            },
            inscricao: {
                titular: ['badge-green', 'Titular'],
                reserva: ['badge-amber', 'Reserva'],
                'no-show': ['badge-red', 'No-Show'],
            },
            aeronave: {
                pronto: ['badge-green', 'Pronto p/ Voo'],
                manutencao: ['badge-amber', 'Manutenção'],
                inoperante: ['badge-red', 'Inoperante'],
            },
        };
        const [cls, label] = (map[tipo] && map[tipo][status]) || ['badge-blue', status];
        return `<span class="badge ${cls}">${label}</span>`;
    }

    function animateCounter(elementId, target) {
        const el = document.getElementById(elementId);
        if (!el) return;
        const start = parseInt(el.textContent) || 0;
        const duration = 600;
        const startTime = performance.now();

        function update(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
            el.textContent = Math.round(start + (target - start) * eased);
            if (progress < 1) requestAnimationFrame(update);
        }
        requestAnimationFrame(update);
    }

    function setupClock() {
        function tick() {
            const now = new Date();
            const timeZulu = now.toLocaleTimeString('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', second: '2-digit' }) + 'Z';
            const timeBrt = now.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', second: '2-digit' });

            const elsZulu = [document.getElementById('clock-zulu'), document.getElementById('tv-clock-zulu')];
            const elsBrt = [document.getElementById('clock-brt'), document.getElementById('tv-clock-brt')];

            elsZulu.forEach(el => { if (el) el.textContent = timeZulu; });
            elsBrt.forEach(el => { if (el) el.textContent = timeBrt; });
        }
        tick();
        setInterval(tick, 1000);
    }

    function setupParticles() {
        const container = document.getElementById('particles');
        if (!container) return;
        for (let i = 0; i < 40; i++) {
            const p = document.createElement('div');
            p.className = 'particle';
            p.style.left = Math.random() * 100 + '%';
            p.style.top = 60 + Math.random() * 40 + '%';
            p.style.animationDelay = Math.random() * 6 + 's';
            p.style.animationDuration = 4 + Math.random() * 4 + 's';
            container.appendChild(p);
        }
    }

    // =====================================================================
    // BUSCA (FILTROS)
    // =====================================================================
    function setupSearch() {
        const searchInputs = {
            'search-voos': { table: 'voos-table', cols: [0, 1] },
            'search-passageiros': { table: 'passageiros-table', cols: [0, 1] },
            'search-inscricoes': { table: 'inscricoes-table', cols: [0, 1] },
            'search-logs': { table: 'logs-table', cols: [1, 2] },
        };

        Object.entries(searchInputs).forEach(([inputId, config]) => {
            const input = document.getElementById(inputId);
            if (!input) return;
            input.addEventListener('input', () => {
                const query = input.value.toLowerCase();
                const rows = document.querySelectorAll(`#${config.table} tr:not(.empty-row)`);
                rows.forEach(row => {
                    const text = config.cols.map(c => row.cells[c]?.textContent || '').join(' ').toLowerCase();
                    row.style.display = text.includes(query) ? '' : 'none';
                });
            });
        });
    }

    // =====================================================================
    const salvarNovoAdmin = async (e) => {
        e.preventDefault();
        const nome = document.getElementById('admin-input-nome').value.trim();
        const email = document.getElementById('admin-input-email').value.trim();
        const saram = document.getElementById('admin-input-saram').value.trim();
        const organizacao = document.getElementById('admin-input-om').value.trim();
        const senha = document.getElementById('admin-input-senha').value.trim();
        const cargoRaw = document.getElementById('admin-input-cargo').value;
        const perfil = cargoRaw ? cargoRaw.toLowerCase() : 'admin';

        if (!nome || !email || !saram || !senha) {
            showToast('Preencha todos os campos obrigatórios.', 'warning');
            return;
        }

        try {
            const { error } = await supabase
                .from('usuarios_admin')
                .insert([{ nome, email, saram, organizacao, perfil, senha }]);

            if (error) {
                console.error(error);
                showToast('Erro ao cadastrar: ' + error.message, 'error');
            } else {
                showToast('Administrador cadastrado com sucesso!', 'success');
                window.fecharModalAdmin();
                document.getElementById('form-novo-admin').reset();
                loadSectionData('admins');
            }
        } catch (err) {
            console.error(err);
            showToast('Erro inesperado ao cadastrar administrador.', 'error');
        }
    };

    const salvarNovoPassageiro = async (e) => {
        e.preventDefault();
        const payload = {
            cpf: document.getElementById('pax-cpf').value.replace(/\D/g, ''),
            nome_completo: document.getElementById('pax-nome').value.trim(),
            posto_graduacao: document.getElementById('pax-posto').value,
            peso_kg: parseInt(document.getElementById('pax-peso').value, 10),
            email: document.getElementById('pax-email').value.trim(),
            telefone: document.getElementById('pax-telefone').value.trim()
        };

        try {
            const { error } = await supabase.from('passageiros').insert([payload]);
            if (error) throw error;
            showToast('Passageiro cadastrado com sucesso!', 'success');
            document.getElementById('form-novo-passageiro').reset();
            loadSectionData('passageiros');
        } catch (err) {
            console.error(err);
            showToast('Erro ao cadastrar passageiro: ' + err.message, 'error');
        }
    };

    const salvarNovaAeronave = async (e) => {
        e.preventDefault();
        const payload = {
            modelo: document.getElementById('aero-modelo').value.trim(),
            matricula_fab: document.getElementById('aero-matricula').value.trim().toUpperCase(),
            capacidade_pax: parseInt(document.getElementById('aero-vagas').value, 10),
            payload_max_kg: parseFloat(document.getElementById('aero-payload').value),
            status: 'pronto'
        };

        try {
            const { error } = await supabase.from('aeronaves').insert([payload]);
            if (error) throw error;
            showToast('Aeronave registrada com sucesso!', 'success');
            document.getElementById('form-nova-aeronave').reset();
            loadSectionData('aeronaves');
        } catch (err) {
            console.error(err);
            showToast('Erro ao registrar aeronave: ' + err.message, 'error');
        }
    };

    // EXPOSIÇÃO PÚBLICA (API do módulo)
    // =====================================================================
    return {
        init,
        navigateTo,
        editVoo,
        deleteVoo,
        editPassageiro,
        deletePassageiro,
        editInscricao,
        deleteInscricao,
        abrirModalAeronave,
        editAeronave: abrirModalAeronave,
        deleteAeronave,
        deleteAdmin,
        changeAdminPassword,
        editAdminProfile,
        showToast,
        salvarNovoAdmin,
        salvarNovoPassageiro,
        salvarNovaAeronave,
    };
})();

// ===== BOOT =====
document.addEventListener('DOMContentLoaded', () => {
    SisCAN.init();
});

// ===== EXPORTE DE FUNÇÕES PARA A UI GLOBAL (onclicks) =====
window.navigateTo = SisCAN.navigateTo;

window.ativarModoTV = () => {
    window.location.href = '/tv.html';
};

window.sairDoModoTV = () => {
    window.location.href = '/';
};

window.abrirModalAdmin = () => {
    const modal = document.getElementById('modal-novo-admin');
    if (modal) modal.classList.remove('hidden');
};

window.fecharModalAdmin = () => {
    const modal = document.getElementById('modal-novo-admin');
    if (modal) modal.classList.add('hidden');
};

window.salvarNovoAdmin = SisCAN.salvarNovoAdmin;
window.salvarNovoPassageiro = SisCAN.salvarNovoPassageiro;
window.salvarNovaAeronave = SisCAN.salvarNovaAeronave;
window.deleteAdmin = SisCAN.deleteAdmin;
window.changeAdminPassword = SisCAN.changeAdminPassword;
window.editAdminProfile = SisCAN.editAdminProfile;

window.exportarLogsCSV = () => {
    SisCAN.showToast('Exportando logs...', 'info');
};

window.processarNoShowsEConvocar = () => {
    SisCAN.showToast('Processando No-Shows...', 'info');
};
