package com.bigdoors.block;

import java.util.List;
import java.util.Map;

import com.bigdoors.BigdoorsMod;
import com.bigdoors.DoorManager;
import com.bigdoors.domain.DoorAssembly;
import com.bigdoors.domain.MaterialRegistry;
import com.bigdoors.domain.PanelRotation;
import com.bigdoors.subsystem.DoorMover;
import com.bigdoors.subsystem.RedstoneHandler;
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
import net.minecraft.world.level.BlockGetter;
import net.minecraft.world.level.redstone.Orientation;
import net.minecraft.core.Direction;
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

        long tick = level.getGameTime();
        manager.setRedstoneDebounce(assembly.getId(), tick + Constants.REDSTONE_DEBOUNCE_TICKS);
        if (assembly.getPartnerAssemblyId() != null) {
            manager.setRedstoneDebounce(assembly.getPartnerAssemblyId(), tick + Constants.REDSTONE_DEBOUNCE_TICKS);
        }

        if (!assembly.isOpen()) {
            DoorMover.tryOpen(manager, assembly, player, level);
        } else {
            DoorMover.tryClose(manager, assembly, level);
        }
        return InteractionResult.SUCCESS;
    }

    protected String getHingeType() {
        return "hinge";
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
            assembly = manager.createAssembly(bp, facing, "horizontal", getHingeType());
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
        for (Map.Entry<String, BlockPos3> entry : Constants.HORIZONTAL_DIR_OFFSETS.entrySet()) {
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
        Map<String, BlockPos3> offsets = "vertical".equals(assembly.getMode())
                ? Constants.DIR_OFFSETS : Constants.HORIZONTAL_DIR_OFFSETS;
        for (Map.Entry<String, BlockPos3> entry : offsets.entrySet()) {
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

        if ("up".equals(direction) || "down".equals(direction)) {
            manager.setMode(assembly.getId(), "vertical");
        }
        manager.setDoorSide(assembly.getId(), direction);

        manager.startConversion(neighborPos);
        try {
            int geoClass = MaterialRegistry.geometryClassForMaterial(matIdx);
            int overlay = "hidden".equals(assembly.getHingeType()) ? 0 : 1;
            int rotation = PanelRotation.closedRotation(direction, assembly.getFacing(), geoClass);
            Integer geoId = resolveGeometryId(matIdx, geoClass, null, null);

            Block panelBlock = ModBlocks.panelBlockForGeoClass(geoClass);
            BlockState panelState = DoorPanelBlock.applyMaterialIndex(
                    panelBlock.defaultBlockState(), matIdx)
                    .setValue(DoorPanelBlock.PANEL_ROTATION, rotation)
                    .setValue(DoorPanelBlock.OVERLAY, overlay);
            panelState = applyGeometryVariant(panelState, geoId);
            level.setBlockAndUpdate(neighborPos, panelState);
            manager.addPanelToAssembly(assembly.getId(), panelBp, matIdx,
                    geoId, overlay);
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
            int geoClass = MaterialRegistry.geometryClassForMaterial(matIdx);
            int overlay = "hidden".equals(assembly.getHingeType()) ? 0 : 1;
            int rotation = PanelRotation.closedRotation(assembly.getDoorSide(),
                    assembly.getFacing(), geoClass);
            Integer geoId = resolveGeometryId(matIdx, geoClass, null, null);

            Block panelBlock = ModBlocks.panelBlockForGeoClass(geoClass);
            BlockState panelState = DoorPanelBlock.applyMaterialIndex(
                    panelBlock.defaultBlockState(), matIdx)
                    .setValue(DoorPanelBlock.PANEL_ROTATION, rotation)
                    .setValue(DoorPanelBlock.OVERLAY, overlay);
            panelState = applyGeometryVariant(panelState, geoId);
            level.setBlockAndUpdate(neighborPos, panelState);
            manager.addPanelToAssembly(assembly.getId(), panelBp, matIdx,
                    geoId, overlay);
        } finally {
            manager.endConversion(neighborPos);
        }

        checkDoubleDoorAfterConversion(level, manager, assembly);
    }

    static Integer resolveGeometryId(int matIdx, int geoClass, Boolean neighborBefore, Boolean neighborAfter) {
        if (geoClass == 0) return null;
        boolean before = neighborBefore != null ? neighborBefore : false;
        boolean after = neighborAfter != null ? neighborAfter : false;
        return MaterialRegistry.resolveGeometryId(matIdx, before, after);
    }

    static BlockState applyGeometryVariant(BlockState state, Integer geoId) {
        if (geoId == null) return state;
        try {
            net.minecraft.world.level.block.state.properties.IntegerProperty gvProp =
                    (net.minecraft.world.level.block.state.properties.IntegerProperty)
                    state.getBlock().getStateDefinition().getProperty("geometry_variant");
            if (gvProp != null) {
                return state.setValue(gvProp, geoId);
            }
        } catch (ClassCastException ignored) {}
        return state;
    }

    // --- Redstone: open / close door on power transition ---

    private static void handleRedstone(BlockState state, Level level, BlockPos pos,
                                       DoorManager manager, DoorAssembly assembly) {
        RedstoneHandler.handleRedstone(state, level, pos, manager, assembly);
    }

    // --- Redstone propagation: pass signal through to the opposite face ---

    @Override
    protected boolean isSignalSource(BlockState state) {
        return state.getValue(POWERED);
    }

    @Override
    protected int getSignal(BlockState state, BlockGetter level, BlockPos pos, Direction direction) {
        return state.getValue(POWERED) ? Constants.REDSTONE_PROPAGATION_POWER : 0;
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
