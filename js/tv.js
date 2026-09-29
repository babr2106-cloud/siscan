// Inicialização do Supabase
const supabaseUrl = 'https://slndtvffmpjrfbfqhnld.supabase.co';
const supabaseKey = 'sb_publishable_SAGHfhAc4_dehQHWSkqshg_14T0M656';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// Formatação de data/hora
function formatTime(dateString) {
    if (!dateString) return '--:--';
    const date = new Date(dateString);
    const options = { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' };
    return date.toLocaleTimeString('pt-BR', options);
}

function formatZuluTime(dateString) {
    if (!dateString) return '--:--';
    const date = new Date(dateString);
    const options = { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' };
    return date.toLocaleTimeString('pt-BR', options) + 'Z';
}

function getFlightNumber(vooId) {
    // Generate a determinist flight number string based on the UUID
    if (!vooId) return 'CAN-0000';
    return 'CAN-' + vooId.substring(0, 4).toUpperCase();
}

async function loadTVData() {
    try {
        // Fetch flights for today/future
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const { data: voos, error: voosError } = await supabase
            .from('voos')
            .select(`
                id,
                destino,
                data_horario,
                status,
                vagas_totais,
                aeronaves (modelo, matricula_fab)
            `)
            .gte('data_horario', today.toISOString())
            .order('data_horario', { ascending: true });

        if (voosError) throw voosError;

        if (!voos || voos.length === 0) {
            document.getElementById('tv-voos-lista').innerHTML = '<div class="text-white">Nenhum voo programado para hoje.</div>';
            return;
        }

        renderVoosList(voos);

        // Find the active flight (embarcando or the closest next one)
        let activeVoo = voos.find(v => v.status === 'embarcando');
        if (!activeVoo) {
            activeVoo = voos.find(v => v.status === 'agendado');
        }
        if (!activeVoo) {
            activeVoo = voos[0]; // fallback
        }

        renderActiveFlight(activeVoo);
        await loadPassengers(activeVoo.id);

    } catch (err) {
        console.error('Error loading TV data:', err);
    }
}

function renderVoosList(voos) {
    const listContainer = document.getElementById('tv-voos-lista');
    listContainer.innerHTML = '';

    voos.forEach((voo, index) => {
        const isEmbarcando = voo.status === 'embarcando';
        const isCancelado = voo.status === 'cancelado';
        const isConcluido = voo.status === 'concluido';
        const isCheckin = false; // Add logic if needed
        const isNoHorario = voo.status === 'agendado';

        let bgClass = 'bg-fab-blue-surface';
        let statusBadge = '';
        let portao = '--'; // Simulated
        let opacidade = '';

        if (isEmbarcando) {
            bgClass = 'bg-primary-container';
            statusBadge = `
                <div class="flex items-center space-x-space-xs bg-status-operational-green px-space-md py-1 rounded-sm shadow-lg animate-pulse">
                    <span class="h-3 w-3 rounded-full bg-pure-white"></span>
                    <span class="font-label-lg text-label-lg text-surface-container-lowest font-black tracking-widest uppercase">EMBARCANDO</span>
                </div>
            `;
        } else if (isNoHorario) {
            statusBadge = `
                <div class="flex items-center space-x-1.5 bg-primary-container px-space-md py-1 rounded-sm shadow">
                    <span class="font-label-lg text-label-lg text-pure-white font-black tracking-widest uppercase">NO HORÁRIO</span>
                </div>
            `;
        } else if (isConcluido) {
            bgClass = 'bg-surface-container-low';
            opacidade = 'opacity-80';
            statusBadge = `
                <div class="flex items-center space-x-1.5 bg-status-closed-slate px-space-md py-1 rounded-sm shadow">
                    <span class="font-label-lg text-label-lg text-pure-white font-black tracking-widest uppercase">FECHADO</span>
                </div>
            `;
        }

        const html = `
            <div class="${bgClass} ${opacidade} p-space-md rounded-sm shadow-md relative overflow-hidden transition-all duration-300 mb-2">
                ${isEmbarcando ? `
                <div class="absolute -right-6 -bottom-6 opacity-15">
                    <span class="material-symbols-outlined text-pure-white" style="font-size: 140px;">flight</span>
                </div>` : ''}
                <div class="flex items-start justify-between relative z-10">
                    <div>
                        <span class="font-code-flight text-headline-sm text-secondary font-bold tracking-widest block">${getFlightNumber(voo.id)}</span>
                        <h3 class="font-display-tv text-headline-md text-pure-white font-bold tracking-tight">${voo.destino.toUpperCase()}</h3>
                        <p class="font-title-md text-title-md text-on-surface-variant font-medium">Aeronave ${voo.aeronaves?.modelo || 'N/A'}</p>
                    </div>
                    <div class="text-right">
                        <span class="font-label-sm text-label-sm ${isConcluido ? 'text-outline' : 'text-primary'} tracking-widest uppercase block">Partida</span>
                        <span class="font-code-flight text-headline-md text-pure-white font-bold">${formatTime(voo.data_horario)}</span>
                    </div>
                </div>
                <div class="mt-space-md flex items-center justify-between pt-space-xs relative z-10">
                    <span class="font-label-md text-label-md text-pure-white uppercase font-bold tracking-wider">Portão ${portao}</span>
                    ${statusBadge}
                </div>
            </div>
        `;
        listContainer.insertAdjacentHTML('beforeend', html);
    });
}

function renderActiveFlight(voo) {
    document.getElementById('tv-voo-codigo').textContent = getFlightNumber(voo.id);
    document.getElementById('tv-voo-destino').textContent = voo.destino.toUpperCase();
    document.getElementById('tv-voo-portao').textContent = '--'; // Simulated
    document.getElementById('tv-voo-aeronave').textContent = voo.aeronaves?.modelo.toUpperCase() || 'N/A';
    document.getElementById('tv-voo-partida').innerHTML = `${formatTime(voo.data_horario)} BRT <span class="text-cadet-gray text-label-sm font-normal">(${formatZuluTime(voo.data_horario)})</span>`;
}

async function loadPassengers(vooId) {
    try {
        const { data: inscricoes, error } = await supabase
            .from('inscricoes')
            .select(`
                status,
                passageiros (
                    posto_graduacao,
                    nome_completo
                )
            `)
            .eq('voo_id', vooId);

        if (error) throw error;

        const listContainer = document.getElementById('tv-passageiros-lista');
        listContainer.innerHTML = '';

        if (!inscricoes || inscricoes.length === 0) {
            listContainer.innerHTML = '<div class="text-white col-span-2 text-center p-4">Nenhum passageiro inscrito.</div>';
            return;
        }

        // Ordenar: Titulares primeiro
        inscricoes.sort((a, b) => {
            if (a.status === 'titular' && b.status !== 'titular') return -1;
            if (a.status !== 'titular' && b.status === 'titular') return 1;
            return 0;
        });

        inscricoes.forEach(insc => {
            const pax = insc.passageiros;
            const isTitular = insc.status === 'titular';
            
            let bgClass = isTitular ? 'bg-fab-blue-surface' : 'bg-surface-container-lowest border border-status-amber-waiting/30 relative overflow-hidden';
            let statusText = isTitular ? 'TITULAR' : 'RESERVA';
            let statusBadgeClass = isTitular ? 'bg-status-operational-green text-surface-container-lowest' : 'bg-status-amber-waiting text-surface-container-lowest relative z-10';
            let textClass = isTitular ? 'text-secondary' : 'text-status-amber-waiting relative z-10';
            let nameClass = isTitular ? 'text-pure-white' : 'text-pure-white relative z-10';
            
            let extraHTML = isTitular ? '' : '<div class="absolute inset-0 bg-status-amber-waiting/5"></div>';

            const html = `
                <div class="${bgClass} p-space-sm rounded-sm flex items-center justify-between shadow-md">
                    ${extraHTML}
                    <div class="flex items-center space-x-space-sm min-w-0">
                        <span class="font-code-flight text-title-md ${textClass} font-bold w-24 shrink-0">${pax.posto_graduacao || 'CIVIL'}</span>
                        <span class="font-headline-sm text-headline-sm ${nameClass} font-bold truncate">${pax.nome_completo.toUpperCase()}</span>
                    </div>
                    <span class="${statusBadgeClass} font-black font-label-md text-label-md px-space-md py-1 rounded-sm shrink-0 tracking-wider">
                        ${statusText}
                    </span>
                </div>
            `;
            listContainer.insertAdjacentHTML('beforeend', html);
        });
    } catch (err) {
        console.error('Error loading passengers:', err);
    }
}

// Auto-refresh every 30 seconds
setInterval(loadTVData, 30000);

// Initial load
document.addEventListener('DOMContentLoaded', loadTVData);
