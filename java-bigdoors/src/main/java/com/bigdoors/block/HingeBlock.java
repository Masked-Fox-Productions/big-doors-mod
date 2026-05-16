package com.bigdoors.block;

import java.util.List;
import java.util.Map;

import com.bigdoors.BigdoorsMod;
import com.bigdoors.DoorManager;
import com.bigdoors.domain.DoorAssembly;
import com.bigdoors.domain.MaterialRegistry;
import com.bigdoors.subsystem.DoorMover;
import com.bigdoors.util.BlockPos3;
import com.bigdoors.util.Constants;
import net.minecraft.core.BlockPos;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.context.BlockPlaceContext;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.state.BlockBehaviour;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.block.state.StateDefinition;
import net.minecraft.world.level.block.state.properties.BlockStateProperties;
import net.minecraft.world.level.block.state.properties.BooleanProperty;
import net.minecraft.world.level.block.state.properties.EnumProperty;
import net.minecraft.world.level.redstone.Orientation;
import net.minecraft.world.level.storage.loot.LootParams;
import net.minecraft.world.phys.BlockHitResult;
import org.jspecify.annotations.Nullable;

/**
 * The hinge block anchors a door assembly. It tracks facing direction,
 * operating mode (horizontal/vertical), and redstone power state.
 * On placement it creates or merges into an assembly, and on neighbor
 * updates it detects and converts supported vanilla blocks into door panels.
 */
public class HingeBlock extends Block {

    public static final EnumProperty<net.minecraft.core.Direction> FACING = BlockStateProperties.HORIZONTAL_FACING;
    public static final EnumProperty<DoorMode> MODE = EnumProperty.create("mode", DoorMode.class);
    public static final BooleanProperty POWERED = BlockStateProperties.POWERED;

    public HingeBlock(BlockBehaviour.Properties properties) {
        super(properties);
        registerDefaultState(stateDefinition.any()
                .setValue(FACING, net.minecraft.core.Direction.NORTH)
                .setValue(MODE, DoorMode.HORIZONTAL)
                .setValue(POWERED, false));
    }

    @Override
    protected void createBlockStateDefinition(StateDefinition.Builder<Block, BlockState> builder) {
        builder.add(FACING, MODE, POWERED);
    }

    @Override
    public BlockState getStateForPlacement(BlockPlaceContext context) {
        return defaultBlockState()
                .setValue(FACING, context.getHorizontalDirection().getOpposite())
                .setValue(MODE, DoorMode.HORIZONTAL)
                .setValue(POWERED, false);
    }

    @Override
    protected List<ItemStack> getDrops(BlockState state, LootParams.Builder params) {
        return List.of();
    }

    // --- Interaction: open / close door ---

    @Override
    protected InteractionResult useWithoutItem(BlockState state, Level level, BlockPos pos,
                                               Player player, BlockHitResult hitResult) {
        if (level.isClientSide()) return InteractionResult.SUCCESS;
        DoorManager manager = BigdoorsMod.getManager();
        if (manager == null) return InteractionResult.PASS;

        BlockPos3 bp = new BlockPos3(pos.getX(), pos.getY(), pos.getZ());
        DoorAssembly assembly = manager.findByPosition(bp);
        if (assembly == null) return InteractionResult.PASS;
        if (assembly.getPanelPositions().isEmpty()) return InteractionResult.PASS;

        if (!assembly.isOpen()) {
            DoorMover.tryOpen(manager, assembly, player, level);
        } else {
            DoorMover.tryClose(manager, assembly, level);
        }
        return InteractionResult.SUCCESS;
    }

    // --- Placement: create or merge assembly, detect double doors ---

    @Override
    public void setPlacedBy(Level level, BlockPos pos, BlockState state,
                            @Nullable LivingEntity by, ItemStack itemStack) {
        if (level.isClientSide()) return;
        DoorManager manager = BigdoorsMod.getManager();
        if (manager == null) return;

        BlockPos3 bp = new BlockPos3(pos.getX(), pos.getY(), pos.getZ());

        // 1. Try to merge with adjacent hinge above or below
        DoorAssembly assembly = mergeWithAdjacentHinge(level, manager, pos, bp);

        // 2. If no merge, create new assembly
        if (assembly == null) {
            String facing = state.getValue(FACING).getName();
            assembly = manager.createAssembly(bp, facing, "horizontal");
        }

        // 3. Check for double-door pairing
        detectDoubleDoor(level, manager, assembly, bp);
    }

    private static DoorAssembly mergeWithAdjacentHinge(Level level, DoorManager manager,
                                                        BlockPos pos, BlockPos3 bp) {
        BlockPos[] verticalNeighbors = { pos.above(), pos.below() };
        for (BlockPos neighborPos : verticalNeighbors) {
            BlockState neighborState = level.getBlockState(neighborPos);
            if (neighborState.getBlock() instanceof HingeBlock) {
                BlockPos3 neighborBp = new BlockPos3(neighborPos.getX(), neighborPos.getY(), neighborPos.getZ());
                DoorAssembly existing = manager.findByPosition(neighborBp);
                if (existing != null) {
                    manager.addHingeToAssembly(existing.getId(), bp);
                    return existing;
                }
            }
        }
        return null;
    }

    private static void detectDoubleDoor(Level level, DoorManager manager,
                                          DoorAssembly assembly, BlockPos3 bp) {
        for (Map.Entry<String, BlockPos3> entry : Constants.DIR_OFFSETS.entrySet()) {
            String dir = entry.getKey();
            BlockPos3 offset = entry.getValue();
            BlockPos neighborPos = new BlockPos(bp.x() + offset.x(), bp.y() + offset.y(), bp.z() + offset.z());
            BlockState neighborState = level.getBlockState(neighborPos);

            if (neighborState.getBlock() instanceof DoorPanelBlock) {
                BlockPos3 neighborBp = new BlockPos3(neighborPos.getX(), neighborPos.getY(), neighborPos.getZ());
                DoorAssembly otherAssembly = manager.findByPosition(neighborBp);
                if (otherAssembly != null
                        && !otherAssembly.getId().equals(assembly.getId())
                        && otherAssembly.getDoorSide() != null
                        && otherAssembly.getPartnerAssemblyId() == null) {
                    // The direction from this hinge to the panel must be opposite the other assembly's doorSide
                    String otherDoorSide = otherAssembly.getDoorSide();
                    if (dir.equals(Constants.OPPOSITE_DIR.get(otherDoorSide))) {
                        manager.setDoorSide(assembly.getId(), dir);
                        manager.pairAndSplitAssemblies(assembly.getId(), otherAssembly.getId());
                        return;
                    }
                }
            }
        }
    }

    // --- Neighbor update: detect and convert vanilla blocks into panels ---

    @Override
    protected void neighborChanged(BlockState state, Level level, BlockPos pos, Block block,
                                   @Nullable Orientation orientation, boolean movedByPiston) {
        if (level.isClientSide()) return;
        DoorManager manager = BigdoorsMod.getManager();
        if (manager == null) return;
        if (manager.isConversionInProgress(pos)) return;

        BlockPos3 bp = new BlockPos3(pos.getX(), pos.getY(), pos.getZ());
        DoorAssembly assembly = manager.findByPosition(bp);
        if (assembly == null) return;

        tryConvertNeighbors(level, manager, assembly, pos);

        // Redstone power detection
        handleRedstone(state, level, pos, manager, assembly);
    }

    private static void tryConvertNeighbors(Level level, DoorManager manager,
                                             DoorAssembly assembly, BlockPos pos) {
        for (Map.Entry<String, BlockPos3> entry : Constants.DIR_OFFSETS.entrySet()) {
            String dir = entry.getKey();
            BlockPos3 offset = entry.getValue();
            BlockPos neighborPos = new BlockPos(
                    pos.getX() + offset.x(), pos.getY() + offset.y(), pos.getZ() + offset.z());

            if (assembly.getDoorSide() == null) {
                // No door side set yet — check if neighbor is a supported material
                if (tryConvertAndSetDoorSide(level, manager, assembly, neighborPos, dir)) {
                    // After setting door side, check for double door along that direction
                    checkDoubleDoorAfterConversion(level, manager, assembly);
                    return; // Only convert the first found neighbor when setting door side
                }
            } else if (dir.equals(assembly.getDoorSide())) {
                // Door side is set, only convert on that side
                tryConvertBlock(level, manager, assembly, neighborPos, dir);
            }
        }
    }

    /**
     * Attempts to convert a neighbor block and set the door side if successful.
     * Returns true if conversion happened.
     */
    private static boolean tryConvertAndSetDoorSide(Level level, DoorManager manager,
                                                      DoorAssembly assembly,
                                                      BlockPos neighborPos, String direction) {
        if (manager.isConversionInProgress(neighborPos)) return false;

        BlockState neighborState = level.getBlockState(neighborPos);
        Block neighborBlock = neighborState.getBlock();
        if (neighborBlock instanceof HingeBlock || neighborBlock instanceof DoorPanelBlock) return false;

        String typeId = BuiltInRegistries.BLOCK.getKey(neighborBlock).toString();
        int matIdx = MaterialRegistry.indexForTypeId(typeId);
        if (matIdx < 0) return false;

        BlockPos3 panelBp = new BlockPos3(neighborPos.getX(), neighborPos.getY(), neighborPos.getZ());
        manager.setDoorSide(assembly.getId(), direction);
        manager.startConversion(neighborPos);
        try {
            BlockState panelState = ModBlocks.DOOR_PANEL_BLOCK.defaultBlockState()
                    .setValue(DoorPanelBlock.MATERIAL_INDEX, matIdx);
            level.setBlockAndUpdate(neighborPos, panelState);
            manager.addPanelToAssembly(assembly.getId(), panelBp, matIdx);
        } finally {
            manager.endConversion(neighborPos);
        }
        return true;
    }

    /**
     * Converts a single neighbor block to a door panel if it is a supported material.
     * Assumes doorSide is already set and direction matches.
     */
    static void tryConvertBlock(Level level, DoorManager manager,
                                 DoorAssembly assembly, BlockPos neighborPos, String direction) {
        if (manager.isConversionInProgress(neighborPos)) return;

        BlockState neighborState = level.getBlockState(neighborPos);
        Block neighborBlock = neighborState.getBlock();
        if (neighborBlock instanceof HingeBlock || neighborBlock instanceof DoorPanelBlock) return;

        String typeId = BuiltInRegistries.BLOCK.getKey(neighborBlock).toString();
        int matIdx = MaterialRegistry.indexForTypeId(typeId);
        if (matIdx < 0) return;

        // Door side checks
        String wallSide = Constants.OPPOSITE_DIR.get(assembly.getDoorSide());
        if (direction.equals(wallSide)) return;
        if (!direction.equals(assembly.getDoorSide())) return;

        BlockPos3 panelBp = new BlockPos3(neighborPos.getX(), neighborPos.getY(), neighborPos.getZ());
        manager.startConversion(neighborPos);
        try {
            BlockState panelState = ModBlocks.DOOR_PANEL_BLOCK.defaultBlockState()
                    .setValue(DoorPanelBlock.MATERIAL_INDEX, matIdx);
            level.setBlockAndUpdate(neighborPos, panelState);
            manager.addPanelToAssembly(assembly.getId(), panelBp, matIdx);
        } finally {
            manager.endConversion(neighborPos);
        }

        // Check for double door after each conversion
        checkDoubleDoorAfterConversion(level, manager, assembly);
    }

    // --- Redstone: open / close door on power transition ---

    private static void handleRedstone(BlockState state, Level level, BlockPos pos,
                                       DoorManager manager, DoorAssembly assembly) {
        boolean wasPowered = state.getValue(POWERED);
        boolean isPowered = level.getBestNeighborSignal(pos) > 0;

        if (isPowered == wasPowered) return; // no transition

        // Update the POWERED block state — use UPDATE_CLIENTS (flag 2) to avoid
        // triggering another neighborChanged on ourselves
        level.setBlock(pos, state.setValue(POWERED, isPowered), Block.UPDATE_CLIENTS);

        if (isPowered && !assembly.isOpen()) {
            openWithRedstone(manager, assembly, level);
        } else if (!isPowered && assembly.isOpen()) {
            closeWithRedstone(manager, assembly, level);
        }
    }

    private static void openWithRedstone(DoorManager manager, DoorAssembly assembly, Level level) {
        if (assembly.getPanelPositions().isEmpty()) return;

        BlockPos3 hingePos = assembly.getPrimaryHingePos();
        List<BlockPos3> panelPositions = assembly.getAllCurrentPositions();

        // Try CW first, then CCW
        String direction = "cw";
        boolean opened = DoorMover.attemptOpen(manager, assembly, panelPositions, hingePos, direction, level);
        if (!opened) {
            direction = "ccw";
            opened = DoorMover.attemptOpen(manager, assembly, panelPositions, hingePos, direction, level);
        }
        if (!opened) return;

        // Open partner in mirror direction
        if (assembly.getPartnerAssemblyId() != null) {
            DoorAssembly partner = manager.getAssembly(assembly.getPartnerAssemblyId());
            if (partner != null && !partner.isOpen() && !partner.getPanelPositions().isEmpty()) {
                String mirrorDir = "cw".equals(direction) ? "ccw" : "cw";
                BlockPos3 partnerHinge = partner.getPrimaryHingePos();
                List<BlockPos3> partnerPanels = partner.getAllCurrentPositions();
                DoorMover.attemptOpen(manager, partner, partnerPanels, partnerHinge, mirrorDir, level);
            }
        }
    }

    private static void closeWithRedstone(DoorManager manager, DoorAssembly assembly, Level level) {
        DoorMover.closeAssembly(manager, assembly, level);

        if (assembly.getPartnerAssemblyId() != null) {
            DoorAssembly partner = manager.getAssembly(assembly.getPartnerAssemblyId());
            if (partner != null && partner.isOpen()) {
                DoorMover.closeAssembly(manager, partner, level);
            }
        }
    }

    /**
     * After converting a panel, scan along the door side from the primary hinge
     * to detect a facing hinge belonging to a different, unpaired assembly.
     */
    private static void checkDoubleDoorAfterConversion(Level level, DoorManager manager,
                                                        DoorAssembly assembly) {
        if (assembly.getDoorSide() == null || assembly.getPartnerAssemblyId() != null) return;

        BlockPos3 primaryHinge = assembly.getPrimaryHingePos();
        BlockPos3 dirOffset = Constants.DIR_OFFSETS.get(assembly.getDoorSide());
        if (dirOffset == null) return;

        for (int i = 1; i <= Constants.MAX_DOOR_SCAN_RADIUS; i++) {
            BlockPos scanPos = new BlockPos(
                    primaryHinge.x() + dirOffset.x() * i,
                    primaryHinge.y() + dirOffset.y() * i,
                    primaryHinge.z() + dirOffset.z() * i);
            BlockState scanState = level.getBlockState(scanPos);
            Block scanBlock = scanState.getBlock();

            if (scanBlock instanceof HingeBlock) {
                BlockPos3 scanBp = new BlockPos3(scanPos.getX(), scanPos.getY(), scanPos.getZ());
                DoorAssembly otherAssembly = manager.findByPosition(scanBp);
                if (otherAssembly != null
                        && !otherAssembly.getId().equals(assembly.getId())
                        && otherAssembly.getPartnerAssemblyId() == null
                        && otherAssembly.getDoorSide() != null
                        && otherAssembly.getDoorSide().equals(
                                Constants.OPPOSITE_DIR.get(assembly.getDoorSide()))) {
                    manager.pairAndSplitAssemblies(assembly.getId(), otherAssembly.getId());
                }
                return; // Stop scanning at any hinge
            } else if (!(scanBlock instanceof DoorPanelBlock)) {
                return; // Stop scanning at non-panel block
            }
        }
    }
}
